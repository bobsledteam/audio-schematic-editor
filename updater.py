#!/usr/bin/env python3
"""Update channel — Windows-first git / archive install for Endo ASD.

Local build comes from update-channel.json (or errorreporting.js fallback).
Remote build is read from:
  1) git remote (fetch + show origin/<branch>:update-channel.json), or
  2) archiveUrl / raw channel URL, or
  3) gitUrl zipball guess (GitHub/GitLab style).

Install writes a persistent overlay under the user app-data folder so frozen
onefile builds on Windows can pick up new UI without rewriting Program Files.
Source checkouts prefer `git pull --ff-only` when a .git directory is present.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
import zipfile
from pathlib import Path
from typing import Any

CHANNEL_NAME = 'update-channel.json'
UI_NAMES = (
    'index.html',
    'app.js',
    'assets.js',
    'cad.js',
    'engines.js',
    'errorreporting.js',
    'materials.js',
    'gate.js',
    'gate.css',
    'styles.css',
    'update-channel.json',
    'assets',
)


def bundled_root() -> Path:
    if getattr(sys, 'frozen', False):
        return Path(getattr(sys, '_MEIPASS', Path(sys.executable).resolve().parent))
    return Path(__file__).resolve().parent


def overlay_dir() -> Path:
    """Persistent UI overlay (survives onefile extract; Windows-friendly)."""
    if sys.platform == 'win32':
        base = Path(os.environ.get('LOCALAPPDATA') or Path.home()) / 'EndoASD'
    elif sys.platform == 'darwin':
        base = Path.home() / 'Library' / 'Application Support' / 'EndoASD'
    else:
        base = Path.home() / '.local' / 'share' / 'EndoASD'
    return base / 'app'


def source_root() -> Path | None:
    """Project root when running from a git / source tree (not frozen)."""
    if getattr(sys, 'frozen', False):
        return None
    root = Path(__file__).resolve().parent
    if (root / 'index.html').is_file():
        return root
    return None


def serve_root() -> Path:
    """Directory the HTTP server should use (overlay wins when present)."""
    overlay = overlay_dir()
    if (overlay / 'index.html').is_file():
        return overlay
    return bundled_root()


def _read_json(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _parse_build_from_errorreporting(text: str) -> int | None:
    m = re.search(r'build:\s*(\d+)', text)
    if not m:
        return None
    try:
        return int(m.group(1))
    except ValueError:
        return None


def local_channel() -> dict[str, Any]:
    for base in (serve_root(), bundled_root(), source_root() or Path()):
        path = base / CHANNEL_NAME
        if path.is_file():
            data = _read_json(path)
            if data:
                return data
    # Fallback: scrape errorreporting.js
    for base in (serve_root(), bundled_root()):
        er = base / 'errorreporting.js'
        if er.is_file():
            build = _parse_build_from_errorreporting(er.read_text(encoding='utf-8', errors='ignore'))
            if build is not None:
                return {'build': build, 'branch': 'main', 'gitUrl': '', 'archiveUrl': ''}
    return {'build': 0, 'branch': 'main', 'gitUrl': '', 'archiveUrl': ''}


def local_build() -> int:
    try:
        return int(local_channel().get('build') or 0)
    except (TypeError, ValueError):
        return 0


def _git_env() -> dict[str, str]:
    env = os.environ.copy()
    # Avoid interactive prompts hanging the UI thread on Windows/macOS.
    env['GIT_TERMINAL_PROMPT'] = '0'
    env['GCM_INTERACTIVE'] = 'never'
    return env


def _git_creationflags() -> int:
    if sys.platform == 'win32':
        # CREATE_NO_WINDOW — keep updater quiet in desktop builds
        return getattr(subprocess, 'CREATE_NO_WINDOW', 0)
    return 0


def _run_git(args: list[str], cwd: Path | None = None, timeout: int = 120) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ['git', *args],
        cwd=str(cwd) if cwd else None,
        capture_output=True,
        text=True,
        timeout=timeout,
        env=_git_env(),
        creationflags=_git_creationflags(),
    )


def _http_get(url: str, timeout: int = 45) -> bytes:
    req = urllib.request.Request(
        url,
        headers={
            'User-Agent': 'EndoASD-Updater/1.0',
            'Accept': '*/*',
        },
        method='GET',
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def _channel_from_text(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith('{'):
        try:
            data = json.loads(text)
            return data if isinstance(data, dict) else {}
        except json.JSONDecodeError:
            pass
    build = _parse_build_from_errorreporting(text)
    if build is not None:
        return {'build': build}
    return {}


def _github_raw_channel_url(git_url: str, branch: str) -> str | None:
    """https://github.com/org/repo(.git) → raw update-channel.json URL."""
    m = re.match(
        r'https?://(?:www\.)?github\.com/([^/]+)/([^/.]+)(?:\.git)?/?$',
        git_url.strip(),
        re.I,
    )
    if not m:
        return None
    org, repo = m.group(1), m.group(2)
    return f'https://raw.githubusercontent.com/{org}/{repo}/{branch}/{CHANNEL_NAME}'


def _github_zip_url(git_url: str, branch: str) -> str | None:
    m = re.match(
        r'https?://(?:www\.)?github\.com/([^/]+)/([^/.]+)(?:\.git)?/?$',
        git_url.strip(),
        re.I,
    )
    if not m:
        return None
    org, repo = m.group(1), m.group(2)
    return f'https://codeload.github.com/{org}/{repo}/zip/refs/heads/{branch}'


def _source_git_root() -> Path | None:
    root = source_root()
    if root and (root / '.git').exists():
        return root
    return None


def _remote_via_git(channel: dict[str, Any]) -> tuple[dict[str, Any] | None, str]:
    root = _source_git_root()
    if not root:
        return None, 'not a git checkout'
    branch = str(channel.get('branch') or 'main').strip() or 'main'
    # Ensure origin exists if gitUrl configured
    git_url = str(channel.get('gitUrl') or '').strip() or os.environ.get('ENDO_UPDATE_GIT_URL', '').strip()
    remotes = _run_git(['remote'], cwd=root)
    has_origin = remotes.returncode == 0 and 'origin' in (remotes.stdout or '').split()
    if git_url and not has_origin:
        add = _run_git(['remote', 'add', 'origin', git_url], cwd=root)
        if add.returncode != 0:
            return None, (add.stderr or add.stdout or 'git remote add failed').strip()
        has_origin = True
    if not has_origin:
        return None, 'no git remote (set gitUrl in update-channel.json after first push)'
    fetch = _run_git(['fetch', 'origin', branch], cwd=root, timeout=180)
    if fetch.returncode != 0:
        # Still try show in case branch already present
        pass
    show = _run_git(['show', f'origin/{branch}:{CHANNEL_NAME}'], cwd=root)
    if show.returncode != 0:
        show = _run_git(['show', f'origin/{branch}:errorreporting.js'], cwd=root)
        if show.returncode != 0:
            err = (fetch.stderr or show.stderr or 'could not read remote channel').strip()
            return None, err
    data = _channel_from_text(show.stdout or '')
    if not data:
        return None, 'remote channel empty'
    data.setdefault('branch', branch)
    return data, 'git'


def _remote_via_http(channel: dict[str, Any]) -> tuple[dict[str, Any] | None, str]:
    branch = str(channel.get('branch') or 'main').strip() or 'main'
    candidates: list[str] = []
    archive = str(channel.get('archiveUrl') or '').strip()
    git_url = str(channel.get('gitUrl') or '').strip() or os.environ.get('ENDO_UPDATE_GIT_URL', '').strip()
    raw = str(channel.get('channelUrl') or '').strip()
    if raw:
        candidates.append(raw)
    if git_url:
        raw_ch = _github_raw_channel_url(git_url, branch)
        if raw_ch:
            candidates.append(raw_ch)
    # Direct channel file next to an archive base is uncommon; skip
    last_err = 'no HTTP update URL configured'
    for url in candidates:
        try:
            body = _http_get(url).decode('utf-8', errors='ignore')
            data = _channel_from_text(body)
            if data.get('build') is not None:
                data.setdefault('branch', branch)
                if archive:
                    data.setdefault('archiveUrl', archive)
                if git_url:
                    data.setdefault('gitUrl', git_url)
                return data, url
            last_err = f'no build in {url}'
        except Exception as exc:
            last_err = str(exc)
    return None, last_err


def check_for_update() -> dict[str, Any]:
    local = local_channel()
    local_b = local_build()
    remote, how = _remote_via_git(local)
    git_err = None if remote is not None else how
    if remote is None:
        remote, how = _remote_via_http(local)
    if remote is None:
        parts = [p for p in (git_err, how) if p]
        return {
            'ok': False,
            'status': 'error',
            'message': ' · '.join(parts) or 'Could not reach update channel',
            'localBuild': local_b,
            'remoteBuild': None,
            'needsUpdate': False,
        }
    try:
        remote_b = int(remote.get('build') or 0)
    except (TypeError, ValueError):
        remote_b = 0
    if remote_b <= 0:
        return {
            'ok': False,
            'status': 'error',
            'message': 'Remote build number missing',
            'localBuild': local_b,
            'remoteBuild': None,
            'needsUpdate': False,
        }
    if remote_b > local_b:
        return {
            'ok': True,
            'status': 'update-available',
            'message': f'Build {remote_b} available (you have {local_b})',
            'localBuild': local_b,
            'remoteBuild': remote_b,
            'needsUpdate': True,
            'source': how,
            'branch': remote.get('branch') or local.get('branch'),
            'gitUrl': remote.get('gitUrl') or local.get('gitUrl'),
            'archiveUrl': remote.get('archiveUrl') or local.get('archiveUrl'),
        }
    return {
        'ok': True,
        'status': 'up-to-date',
        'message': f'Up to date (build {local_b})',
        'localBuild': local_b,
        'remoteBuild': remote_b,
        'needsUpdate': False,
        'source': how,
    }


def _copy_ui_tree(src_dir: Path, dest: Path) -> None:
    dest.mkdir(parents=True, exist_ok=True)
    for name in UI_NAMES:
        src = src_dir / name
        if not src.exists():
            continue
        target = dest / name
        if src.is_dir():
            if target.exists():
                shutil.rmtree(target)
            shutil.copytree(src, target)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, target)


def _find_ui_root_in_extract(extract_dir: Path) -> Path | None:
    if (extract_dir / 'index.html').is_file():
        return extract_dir
    for child in extract_dir.iterdir():
        if child.is_dir() and (child / 'index.html').is_file():
            return child
    # deeper one level
    for child in extract_dir.iterdir():
        if not child.is_dir():
            continue
        for nested in child.iterdir():
            if nested.is_dir() and (nested / 'index.html').is_file():
                return nested
    return None


def _install_from_zip_bytes(data: bytes) -> str:
    dest = overlay_dir()
    with tempfile.TemporaryDirectory(prefix='endo-upd-') as tmp:
        zpath = Path(tmp) / 'update.zip'
        zpath.write_bytes(data)
        extract = Path(tmp) / 'out'
        extract.mkdir()
        with zipfile.ZipFile(zpath, 'r') as zf:
            zf.extractall(extract)
        ui = _find_ui_root_in_extract(extract)
        if ui is None:
            raise RuntimeError('Update archive missing index.html')
        # Replace overlay atomically-ish
        if dest.exists():
            bak = dest.with_name(dest.name + '.bak')
            if bak.exists():
                shutil.rmtree(bak, ignore_errors=True)
            dest.rename(bak)
            try:
                _copy_ui_tree(ui, dest)
            except Exception:
                if dest.exists():
                    shutil.rmtree(dest, ignore_errors=True)
                if bak.exists():
                    bak.rename(dest)
                raise
            shutil.rmtree(bak, ignore_errors=True)
        else:
            _copy_ui_tree(ui, dest)
    return str(dest)


def _install_via_git_pull(channel: dict[str, Any]) -> dict[str, Any]:
    root = _source_git_root()
    if not root:
        return {'ok': False, 'message': 'Not a git checkout'}
    branch = str(channel.get('branch') or 'main').strip() or 'main'
    fetch = _run_git(['fetch', 'origin', branch], cwd=root, timeout=180)
    if fetch.returncode != 0:
        return {'ok': False, 'message': (fetch.stderr or fetch.stdout or 'git fetch failed').strip()}
    pull = _run_git(['pull', '--ff-only', 'origin', branch], cwd=root, timeout=180)
    if pull.returncode != 0:
        return {'ok': False, 'message': (pull.stderr or pull.stdout or 'git pull failed').strip()}
    # Also refresh overlay so frozen-adjacent tools stay aligned
    try:
        _copy_ui_tree(root, overlay_dir())
    except Exception:
        pass
    return {
        'ok': True,
        'message': f'Updated to build {local_build()} via git pull',
        'localBuild': local_build(),
        'restartRequired': True,
        'method': 'git-pull',
    }


def _install_via_archive(channel: dict[str, Any]) -> dict[str, Any]:
    branch = str(channel.get('branch') or 'main').strip() or 'main'
    archive = str(channel.get('archiveUrl') or '').strip()
    git_url = str(channel.get('gitUrl') or '').strip() or os.environ.get('ENDO_UPDATE_GIT_URL', '').strip()
    if not archive and git_url:
        archive = _github_zip_url(git_url, branch) or ''
    if not archive:
        return {
            'ok': False,
            'message': 'No archiveUrl / gitUrl — set update-channel.json after pushing the repo',
        }
    try:
        data = _http_get(archive, timeout=180)
        path = _install_from_zip_bytes(data)
    except Exception as exc:
        return {'ok': False, 'message': f'Download/install failed: {exc}'}
    return {
        'ok': True,
        'message': f'Installed build {local_build()} to {path}. Restart the app.',
        'localBuild': local_build(),
        'restartRequired': True,
        'method': 'archive',
        'overlay': path,
    }


def install_update() -> dict[str, Any]:
    status = check_for_update()
    if not status.get('ok'):
        return status
    if not status.get('needsUpdate'):
        return {
            'ok': True,
            'status': 'up-to-date',
            'message': status.get('message') or 'Already up to date',
            'localBuild': status.get('localBuild'),
            'remoteBuild': status.get('remoteBuild'),
            'needsUpdate': False,
            'restartRequired': False,
        }
    channel = local_channel()
    # Prefer remote fields from check
    for key in ('branch', 'gitUrl', 'archiveUrl'):
        if status.get(key):
            channel[key] = status[key]
    if _source_git_root() is not None:
        result = _install_via_git_pull(channel)
        if result.get('ok'):
            return result
        # Fall through to archive if pull failed
        archive_try = _install_via_archive(channel)
        if archive_try.get('ok'):
            archive_try['message'] = (
                f"{archive_try.get('message')} (git pull failed: {result.get('message')})"
            )
            return archive_try
        return result
    return _install_via_archive(channel)
