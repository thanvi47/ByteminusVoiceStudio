"""Keep unsupported small operators on CPU while neural decoder convolutions use DML."""


def cpu_tensor_function(torch, original, device):
    def move(value, target):
        if isinstance(value, torch.Tensor): return value.to(target)
        if isinstance(value, tuple): return tuple(move(v, target) for v in value)
        if isinstance(value, dict): return {k: move(v, target) for k, v in value.items()}
        return value
    def operation(*args, **kwargs):
        return move(original(*move(args, "cpu"), **move(kwargs, "cpu")), device)
    return operation


def token_masks_on_cpu(torch, modeling):
    if getattr(modeling, "_byteminus_cpu_masks", False): return
    def move(value, device):
        if isinstance(value, torch.Tensor): return value.to(device)
        if isinstance(value, tuple): return tuple(move(v, device) for v in value)
        if isinstance(value, dict): return {k: move(v, device) for k, v in value.items()}
        return value
    def wrap(original):
        def operation(input_ids, *args, **kwargs):
            # DML bool * int64 promotion can return bool and corrupt token IDs.
            device = input_ids.device
            return move(original(input_ids.cpu(), *move(args, "cpu"), **move(kwargs, "cpu")), device)
        return operation
    for name in ("build_delay_pattern_mask", "apply_delay_pattern_mask"):
        setattr(modeling, name, wrap(getattr(modeling, name)))
    modeling._byteminus_cpu_masks = True


def decoder_to_directml(torch, decoder, device):
    decoder.to(device)

    def move(value, target):
        if isinstance(value, torch.Tensor): return value.to(target)
        if isinstance(value, tuple): return tuple(move(v, target) for v in value)
        if isinstance(value, list): return [move(v, target) for v in value]
        return value

    decoder.register_forward_pre_hook(lambda module, args: move(args, device))
    decoder.register_forward_hook(lambda module, args, output: move(output, "cpu"))
    cpu_operators = []
    for name, module in decoder.named_modules():
        if isinstance(module, torch.nn.ConvTranspose1d) and module.groups > 1:
            # DML rejects this depthwise transposed convolution (groups=1024).
            module.to("cpu")
            original = module.forward
            def forward(x, output_size=None, original=original):
                return original(x.cpu(), output_size=output_size).to(device)
            module.forward = forward
            cpu_operators.append(name + ":depthwise-conv-transpose")
        elif type(module).__name__ == "TorchSTFT":
            # ComplexFloat terminates torch-directml at native level; catch/retry
            # cannot handle it. Preserve the original FFT on CPU instead of
            # substituting an approximate reconstruction or moving the model.
            module.to("cpu")
            for method in ("transform", "inverse"):
                original = getattr(module, method)
                def fft(*args, original=original):
                    return move(original(*move(args, "cpu")), device)
                setattr(module, method, fft)
            cpu_operators.append(name + ":fft")
    return cpu_operators
