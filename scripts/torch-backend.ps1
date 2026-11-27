function Get-TorchIndex([string]$Device = 'auto') {
    if ($Device -eq 'xpu') { return 'https://download.pytorch.org/whl/xpu' }
    if ($Device -eq 'auto') {
        $adapters = Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue
        if (($adapters.Name -join ' ') -match 'Intel.*Arc' -and ($adapters.Name -join ' ') -notmatch 'NVIDIA') {
            Write-Host 'Selecting official Intel XPU PyTorch wheels. A supported Intel driver/GPU is required.'
            return 'https://download.pytorch.org/whl/xpu'
        }
    }
    $useCuda = $Device -eq 'cuda'
    if ($Device -eq 'auto') {
        $smi = Get-Command nvidia-smi -ErrorAction SilentlyContinue
        if ($smi) {
            $gpuNames = & $smi.Source --query-gpu=name --format=csv,noheader 2>$null
            $useCuda = $LASTEXITCODE -eq 0 -and [bool]$gpuNames
        }
    }
    if ($useCuda) {
        Write-Host 'Selecting official CUDA 12.8 PyTorch wheels. A compatible NVIDIA driver is required.'
        return 'https://download.pytorch.org/whl/cu128'
    }
    Write-Host 'Selecting CPU PyTorch wheels.'
    return 'https://download.pytorch.org/whl/cpu'
}
