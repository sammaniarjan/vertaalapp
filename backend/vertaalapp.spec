# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for Vertaalapp backend.

Bundles the FastAPI backend + all ML dependencies into a single executable.
ML models are NOT included — they are downloaded at first run to
~/Library/Caches/vertaalapp/.
"""

import sys
from pathlib import Path

block_cipher = None

# Hidden imports that PyInstaller can't detect automatically
hidden_imports = [
    # FastAPI / Uvicorn
    'uvicorn',
    'uvicorn.logging',
    'uvicorn.loops',
    'uvicorn.loops.auto',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.websockets',
    'uvicorn.protocols.websockets.auto',
    'uvicorn.lifespan',
    'uvicorn.lifespan.on',
    'fastapi',
    'starlette',
    'starlette.routing',
    'starlette.middleware',
    'starlette.middleware.cors',
    'anyio',
    'anyio._backends',
    'anyio._backends._asyncio',
    'websockets',

    # ML frameworks
    'transformers',
    'transformers.models',
    'transformers.models.marian',
    'transformers.models.marian.modeling_marian',
    'transformers.models.marian.tokenization_marian',
    'transformers.models.nllb',
    'transformers.models.nllb.tokenization_nllb',
    'transformers.models.m2m_100',
    'transformers.models.m2m_100.modeling_m2m_100',
    'transformers.models.m2m_100.tokenization_m2m_100',
    'transformers.models.m2m_100.configuration_m2m_100',
    'torch',
    'torch.nn',
    'torch.nn.functional',
    'sentencepiece',
    'protobuf',
    'google.protobuf',

    # HuggingFace Hub
    'huggingface_hub',
    'huggingface_hub.utils',
    'huggingface_hub.file_download',
    'filelock',
    'tqdm',
    'regex',

    # Safetensors
    'safetensors',
    'safetensors.torch',

    # STT backends (optional — imported dynamically)
    'mlx_whisper',
    'mlx',

    # Misc
    'numpy',
    'logging',
    'json',
    'asyncio',
    'multiprocessing',
]

# Collect all data from these packages (model configs, tokenizer files, etc.)
from PyInstaller.utils.hooks import collect_data_files, collect_submodules, collect_dynamic_libs

datas = []
datas += collect_data_files('transformers', include_py_files=True)
datas += collect_data_files('mlx_whisper')  # tokenizer assets (mel_filters.npz, tiktoken)
datas += collect_data_files('mlx')          # .pyi stubs, headers

# Collect native binaries (.so, .dylib, .metallib) for mlx
binaries = []
binaries += collect_dynamic_libs('mlx')

# Also explicitly include the Metal compute library
import site
_sp = site.getsitepackages()[0] if site.getsitepackages() else ''
if not _sp:
    import sysconfig
    _sp = sysconfig.get_path('purelib')

from pathlib import Path as _Path
_mlx_metallib = _Path(_sp) / 'mlx' / 'lib' / 'mlx.metallib'
if _mlx_metallib.exists():
    binaries.append((str(_mlx_metallib), 'mlx/lib'))

# Collect submodules that are imported dynamically
all_hidden = list(hidden_imports)
all_hidden += collect_submodules('uvicorn')
all_hidden += collect_submodules('fastapi')
all_hidden += collect_submodules('starlette')
all_hidden += collect_submodules('mlx')
all_hidden += collect_submodules('mlx_whisper')

a = Analysis(
    ['run_prod.py'],
    pathex=['.'],
    binaries=binaries,
    datas=datas + [
        ('app', 'app'),
    ],
    hiddenimports=all_hidden,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Exclude dev/test packages to reduce size
        'pytest',
        'pip',
        'setuptools',
        'wheel',
        'tkinter',
        '_tkinter',
        'matplotlib',
        'PIL',
        'IPython',
        'jupyter',
        'notebook',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    target_arch='arm64',
)
