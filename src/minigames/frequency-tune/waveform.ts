/**
 * 표시창 파형의 계산 부분. 잡음 베드의 AnalyserNode에서 읽은 시간 영역 샘플(-1~1)을
 * 캔버스 좌표로 옮긴다. 브라우저 없이 도는 순수 함수만 여기 둔다 (waveform.test.ts).
 * 실제로 긋는 쪽(index.tsx)은 이 좌표를 한 번의 stroke로 잇기만 한다.
 *
 * 매 프레임 도는 코드라 결과를 담을 배열을 밖에서 받는다. 점 객체 64개를 프레임마다
 * 만들면 GC가 튄다 (r3f 규칙과 같은 이유, 여기는 Canvas 2D지만 60fps는 같다).
 */

/** 한 프레임에 긋는 점 수. 분석기 버퍼(256)를 다 그리면 선이 뭉개져 결이 안 보인다. */
export const WAVEFORM_POINTS = 64;

/**
 * 긴 샘플 열을 target 길이만큼 고르게 골라 담는다.
 *
 * 평균을 내지 않고 골라 뽑는다: 백색잡음은 이웃을 평균내면 0으로 수렴해 파형이 사라진다.
 * 보여 주려는 것이 잡음의 결이라 앨리어싱은 오히려 상관없다. 소스가 target보다 짧으면
 * 같은 샘플이 반복되고, 비어 있으면 0으로 채운다.
 */
export function downsample(source: ArrayLike<number>, target: Float32Array): Float32Array {
  const count = target.length;
  if (source.length === 0) {
    target.fill(0);
    return target;
  }
  const step = source.length / count;
  const last = source.length - 1;
  for (let index = 0; index < count; index += 1) {
    target[index] = source[Math.min(last, Math.floor(index * step))];
  }
  return target;
}

/**
 * 샘플(-1~1) → 캔버스 좌표 [x0, y0, x1, y1, ...].
 *
 * x는 0에서 width까지 고르게, y는 세로 가운데에서 위아래로 벌어진다. gain은 세로 배율:
 * 베드의 최대 게인이 0.06이라 그대로 그리면 직선과 구분이 안 된다. 배율을 곱한 값은
 * -1~1로 잘라 선이 캔버스 밖으로 나가지 않게 한다. NaN은 0(가운데)으로 본다.
 *
 * target이 없으면 새로 만든다 (테스트용). 프레임 루프에서는 꼭 재사용할 것.
 */
export function waveformPath(
  samples: ArrayLike<number>,
  width: number,
  height: number,
  gain = 1,
  target: Float32Array = new Float32Array(samples.length * 2),
): Float32Array {
  const count = samples.length;
  const middle = height / 2;
  const stepX = count > 1 ? width / (count - 1) : 0;
  for (let index = 0; index < count; index += 1) {
    const raw = samples[index] * gain;
    const value = Number.isNaN(raw) ? 0 : Math.min(1, Math.max(-1, raw));
    target[index * 2] = index * stepX;
    target[index * 2 + 1] = middle - value * middle;
  }
  return target;
}
