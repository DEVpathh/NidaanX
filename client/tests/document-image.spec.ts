import { expect, test, type Page } from '@playwright/test'

type Point = { x: number; y: number }
type Scene = {
  name: string
  corners: Point[]
  background?: string
  shadow?: boolean
  outline?: boolean
  distractor?: boolean
  markers?: boolean
  width?: number
  height?: number
}

const perspectivePage: Point[] = [
  { x: .41, y: .08 }, { x: .94, y: .18 },
  { x: .84, y: .88 }, { x: .30, y: .77 },
]

const scenes: Scene[] = [
  { name: 'off-center perspective page', corners: perspectivePage },
  {
    name: 'rotated page',
    corners: [
      { x: .444, y: .086 }, { x: .768, y: .279 },
      { x: .556, y: .914 }, { x: .232, y: .721 },
    ],
  },
  { name: 'unevenly lit page with a dark shadow', corners: perspectivePage, shadow: true },
  { name: 'page on a bright desk with a visible dark edge', corners: perspectivePage, background: '#e7e4da', outline: true },
  { name: 'page beside a bright object in another corner', corners: perspectivePage, shadow: true, distractor: true },
  {
    name: 'portrait camera frame', width: 720, height: 960,
    corners: [
      { x: .14, y: .21 }, { x: .88, y: .13 },
      { x: .91, y: .83 }, { x: .09, y: .92 },
    ],
  },
]

async function capture(page: Page, scene: Scene, flatten = false) {
  return page.evaluate(async ({ scene, flatten }) => {
    const modulePath = '/src/shared/scanning/documentImage.ts'
    const { detectDocument, rectify } = await import(/* @vite-ignore */ modulePath)
    const canvas = document.createElement('canvas')
    canvas.width = scene.width ?? 960
    canvas.height = scene.height ?? 720
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = scene.background ?? '#262e39'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    if (scene.distractor) {
      // A separate highlight must not move the crop to the camera's top corner.
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.roundRect(-24, -18, 250, 210, 55)
      ctx.fill()
    }

    const points = scene.corners.map(point => ({ x: point.x * canvas.width, y: point.y * canvas.height }))
    const polygon = (vertices: Point[]) => {
      ctx.beginPath()
      vertices.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y))
      ctx.closePath()
    }
    polygon(points)
    if (scene.shadow) {
      const light = ctx.createLinearGradient(canvas.width * .28, 0, canvas.width * .94, 0)
      light.addColorStop(0, '#606367')
      light.addColorStop(.42, '#96989a')
      light.addColorStop(1, '#f7f5ef')
      ctx.fillStyle = light
    } else {
      ctx.fillStyle = '#f9f8f0'
    }
    ctx.fill()
    if (scene.outline) {
      ctx.strokeStyle = '#55534e'
      ctx.lineWidth = 7
      ctx.stroke()
    }

    // Paint printed content inside the actual page, including slanted text rows.
    // The detector must follow the page boundary instead of the text envelope.
    const pointOnPage = (u: number, v: number): Point => ({
      x: points[0]!.x * (1 - u) * (1 - v) + points[1]!.x * u * (1 - v) + points[2]!.x * u * v + points[3]!.x * (1 - u) * v,
      y: points[0]!.y * (1 - u) * (1 - v) + points[1]!.y * u * (1 - v) + points[2]!.y * u * v + points[3]!.y * (1 - u) * v,
    })
    const pageRect = (u: number, v: number, width: number, height: number, color: string) => {
      ctx.fillStyle = color
      polygon([pointOnPage(u, v), pointOnPage(u + width, v), pointOnPage(u + width, v + height), pointOnPage(u, v + height)])
      ctx.fill()
    }
    pageRect(.21, .18, .55, .027, '#39404a')
    for (let row = 0; row < 16; row++) {
      for (let word = 0; word < 5; word++) {
        pageRect(.17 + word * .135, .27 + row * .032, .105 - ((row + word) % 3) * .014, .009, '#4a4e54')
      }
    }
    if (scene.markers) {
      pageRect(.06, .06, .17, .14, '#eb2424')
      pageRect(.77, .06, .17, .14, '#20c044')
      pageRect(.77, .80, .17, .14, '#244deb')
      pageRect(.06, .80, .17, .14, '#edb424')
    }

    const detected = detectDocument(canvas) as { corners: Point[]; confidence: number } | null
    if (!flatten || !detected) return { detected, flattened: null }
    const output = rectify(canvas, detected.corners)
    const outputContext = output.getContext('2d')!
    const sample = (x: number, y: number) => Array.from(outputContext.getImageData(Math.round(x * (output.width - 1)), Math.round(y * (output.height - 1)), 1, 1).data).slice(0, 3)
    return {
      detected,
      flattened: {
        width: output.width, height: output.height,
        markers: [sample(.14, .13), sample(.86, .13), sample(.86, .87), sample(.14, .87)],
        margins: [sample(.5, .035), sample(.965, .5), sample(.5, .965), sample(.035, .5)],
      },
    }
  }, { scene, flatten })
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

for (const scene of scenes) {
  test(`automatic crop follows the ${scene.name}`, async ({ page }) => {
    const { detected } = await capture(page, scene)
    expect(detected, 'The page should be detected without manual boundary placement.').not.toBeNull()
    expect(detected!.confidence).toBeGreaterThanOrEqual(.65)
    expect(detected!.corners).toHaveLength(4)
    const errors = detected!.corners.map((point, index) => Math.hypot(point.x - scene.corners[index]!.x, point.y - scene.corners[index]!.y))
    expect(Math.max(...errors), `Corner errors: ${JSON.stringify(errors)}`).toBeLessThan(.035)
  })
}

test('detected perspective corners produce an upright page without desk margins', async ({ page }) => {
  const { detected, flattened } = await capture(page, { name: 'marked page', corners: perspectivePage, markers: true }, true)
  expect(detected).not.toBeNull()
  expect(flattened).not.toBeNull()
  expect(flattened!.width).toBeGreaterThan(350)
  expect(flattened!.height).toBeGreaterThan(350)
  const [red, green, blue, yellow] = flattened!.markers
  expect(red![0]).toBeGreaterThan(180)
  expect(red![1]).toBeLessThan(80)
  expect(green![1]).toBeGreaterThan(150)
  expect(green![0]).toBeLessThan(80)
  expect(blue![2]).toBeGreaterThan(180)
  expect(blue![0]).toBeLessThan(80)
  expect(yellow![0]).toBeGreaterThan(180)
  expect(yellow![1]).toBeGreaterThan(130)
  expect(yellow![2]).toBeLessThan(80)
  for (const margin of flattened!.margins) {
    expect(Math.min(...margin), 'All four flattened margins should contain paper, not the desk.').toBeGreaterThan(210)
  }
})

test('empty dark and bright scenes do not claim a detected document', async ({ page }) => {
  const results = await page.evaluate(async () => {
    const modulePath = '/src/shared/scanning/documentImage.ts'
    const { detectDocument } = await import(/* @vite-ignore */ modulePath)
    return ['#262e39', '#f7f7f7'].map(color => {
      const canvas = document.createElement('canvas')
      canvas.width = 960
      canvas.height = 720
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = color
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      return detectDocument(canvas)
    })
  })
  expect(results).toEqual([null, null])
})
