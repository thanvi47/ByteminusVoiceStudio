declare module "@echogarden/espeak-ng-emscripten" {
  const init: () => Promise<any>;
  export default init;
}
declare module "@breezystack/lamejs" {
  export class Mp3Encoder {
    constructor(channels: number, rate: number, bitrate: number);
    encodeBuffer(samples: Int16Array): Int8Array;
    flush(): Int8Array;
  }
}
