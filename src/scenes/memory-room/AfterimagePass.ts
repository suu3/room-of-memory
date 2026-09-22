import { CopyMaterial, Pass } from "postprocessing";
import {
  HalfFloatType,
  LinearFilter,
  ShaderMaterial,
  type Texture,
  Uniform,
  type WebGLRenderer,
  WebGLRenderTarget,
} from "three";

/**
 * 잔상 패스 (docs/visual-experiments.md 11장 "afterimage → 1인칭 두 구간").
 *
 * 지난 프레임을 조금 남기며 새 프레임을 겹친다. 1인칭으로 어둠 속을 걷는 두 구간(인트로의
 * 스위치 찾기, 2막 도입의 문 넘기)에만 붙는다. 30일 만에 움직이는 몸의 잔상이고, 빛에
 * 닿는 순간(스위치·문턱) 구간이 끝나며 패스도 내려간다.
 *
 * postprocessing의 Effect는 입력 버퍼만 읽을 수 있어 되먹임이 안 된다. 그래서 이펙트가
 * 아니라 **패스**다: 누적 버퍼 두 장을 핑퐁하며 `이전 × damp + 현재`를 굽고, 결과를
 * 출력으로 복사한다. three의 AfterimagePass와 같은 구조를 postprocessing 컴포저 위에 얹었다.
 *
 * `damp`는 밖에서 민다 (0 = 잔상 없음, 0.96 = 길게 끌린다). 걷는 속도가 정한다.
 */
const BLEND_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 1.0, 1.0);
  }
`;

const BLEND_FRAGMENT = /* glsl */ `
  uniform sampler2D tOld;
  uniform sampler2D tNew;
  uniform float uDamp;
  varying vec2 vUv;
  void main() {
    vec4 previous = texture2D(tOld, vUv);
    vec4 current = texture2D(tNew, vUv);
    // 어두운 쪽으로는 빨리, 밝은 쪽으로는 느리게: 빛의 잔상만 남고 어둠은 곧 따라잡는다
    vec3 held = max(previous.rgb * uDamp, current.rgb);
    gl_FragColor = vec4(held, 1.0);
  }
`;

export class AfterimagePass extends Pass {
  private readonly blend: ShaderMaterial;
  private readonly copy: CopyMaterial;
  private readonly accumulation: [WebGLRenderTarget, WebGLRenderTarget];
  private read = 0;

  constructor() {
    super("AfterimagePass");
    this.blend = new ShaderMaterial({
      uniforms: {
        tOld: new Uniform<Texture | null>(null),
        tNew: new Uniform<Texture | null>(null),
        uDamp: new Uniform(0),
      },
      vertexShader: BLEND_VERTEX,
      fragmentShader: BLEND_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });
    this.copy = new CopyMaterial();
    const make = () =>
      new WebGLRenderTarget(1, 1, {
        minFilter: LinearFilter,
        magFilter: LinearFilter,
        type: HalfFloatType,
        depthBuffer: false,
      });
    this.accumulation = [make(), make()];
    this.fullscreenMaterial = this.blend;
  }

  /** 잔상이 남는 정도 (0~0.98). 매 프레임 밖에서 민다. */
  set damp(value: number) {
    this.blend.uniforms.uDamp.value = Math.min(0.98, Math.max(0, value));
  }

  override setSize(width: number, height: number): void {
    // 절반 해상도: 잔상은 번진 빛이라 또렷할 필요가 없고, 모바일 예산이 먼저다
    const w = Math.max(1, Math.floor(width / 2));
    const h = Math.max(1, Math.floor(height / 2));
    for (const target of this.accumulation) target.setSize(w, h);
  }

  override render(
    renderer: WebGLRenderer,
    inputBuffer: WebGLRenderTarget,
    outputBuffer: WebGLRenderTarget | null,
  ): void {
    const previous = this.accumulation[this.read];
    const next = this.accumulation[1 - this.read];

    this.blend.uniforms.tOld.value = previous.texture;
    this.blend.uniforms.tNew.value = inputBuffer.texture;
    this.fullscreenMaterial = this.blend;
    renderer.setRenderTarget(next);
    renderer.render(this.scene, this.camera);

    this.copy.inputBuffer = next.texture;
    this.fullscreenMaterial = this.copy;
    renderer.setRenderTarget(this.renderToScreen ? null : outputBuffer);
    renderer.render(this.scene, this.camera);

    this.read = 1 - this.read;
  }

  override dispose(): void {
    super.dispose();
    this.blend.dispose();
    this.copy.dispose();
    for (const target of this.accumulation) target.dispose();
  }
}
