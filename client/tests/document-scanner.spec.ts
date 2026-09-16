import { test, expect, type Page } from '@playwright/test'

async function openScanner(page: Page, blank = false) {
  await page.goto('/')
  await page.evaluate(async blankScene => {
    const camera = document.createElement('canvas')
    camera.width = 960; camera.height = 720
    const ctx = camera.getContext('2d')!
    ctx.fillStyle = '#293945'; ctx.fillRect(0, 0, 960, 720)
    if (!blankScene) {
      ctx.fillStyle = '#f5f3ed'
      ctx.beginPath(); ctx.moveTo(220, 65); ctx.lineTo(790, 125); ctx.lineTo(695, 655); ctx.lineTo(135, 555); ctx.closePath(); ctx.fill()
      ctx.strokeStyle = '#25323b'; ctx.lineWidth = 5
      const onPage = (u: number, v: number) => ({
        x: 220*(1-u)*(1-v)+790*u*(1-v)+695*u*v+135*(1-u)*v,
        y: 65*(1-u)*(1-v)+125*u*(1-v)+655*u*v+555*(1-u)*v,
      })
      for (let row = 0; row < 11; row++) {
        const a = onPage(.18, .20+row*.052), b = onPage(.82, .20+row*.052)
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
      }
    }
    // A video stream needs fresh frames after its track is attached to <video>.
    let frame = ctx.getImageData(0, 0, camera.width, camera.height)
    window.setInterval(() => ctx.putImageData(frame, 0, 0), 100)
    ;(window as any).__resizeCamera = async () => {
      const bitmap = await createImageBitmap(frame)
      camera.width = 720; camera.height = 960
      ctx.drawImage(bitmap, 0, 0, camera.width, camera.height)
      bitmap.close()
      frame = ctx.getImageData(0, 0, camera.width, camera.height)
    }
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
      getUserMedia: async () => camera.captureStream(5),
    } })
    const reactPath = '/node_modules/.vite/deps/react.js'
    const domPath = '/node_modules/.vite/deps/react-dom_client.js'
    const scannerPath = '/src/components/DocumentScanner.tsx'
    const [{ default: React }, { default: ReactDOM }, { DocumentScanner }] = await Promise.all([
      import(reactPath), import(domPath), import(scannerPath),
    ])
    const host = document.createElement('main')
    host.className = 'app-shell'
    host.style.maxWidth = '900px'; host.style.margin = 'auto'
    document.body.replaceChildren(host)
    ReactDOM.createRoot(host).render(React.createElement(DocumentScanner, {
      language: 'English', patientId: 'scanner-test', documents: [], onAddDocument() {}, onRemoveDocument() {},
    }))
  }, blank)
  await page.getByRole('button', { name: 'Open camera', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Capture page', exact: true })).toBeEnabled()
}

test('camera frame follows the page and capture automatically shows a straightened preview', async ({ page }) => {
  await openScanner(page)
  await expect(page.getByLabel('Detected page edges')).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => (window as any).__resizeCamera())
  await expect.poll(() => page.locator('.camera-frame').evaluate(frame => {
    const bounds = frame.getBoundingClientRect()
    return bounds.width / bounds.height
  })).toBeCloseTo(720 / 960, 2)
  await expect(page.getByLabel('Detected page edges')).toBeVisible()
  const geometry = await page.locator('.camera-frame').evaluate(frame => {
    const video = frame.querySelector('video')!.getBoundingClientRect()
    const overlay = frame.querySelector('svg')!.getBoundingClientRect()
    return { width: Math.abs(video.width - overlay.width), height: Math.abs(video.height - overlay.height), left: Math.abs(video.left - overlay.left), top: Math.abs(video.top - overlay.top) }
  })
  expect(Object.values(geometry).every(delta => delta < 1)).toBeTruthy()
  await page.screenshot({ path: 'artifacts/scanner-live-frame-mobile.png', fullPage: true })
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.getByRole('button', { name: 'Capture page', exact: true }).click()
  await expect(page.getByAltText('Straightened page', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Page corners', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Read page', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Adjust corners', exact: true }).click()
  await expect(page.getByLabel('Page corners', { exact: true })).toBeVisible()
  const points = await page.locator('.crop-preview polygon').getAttribute('points')
  await page.getByLabel('Page corner 1', { exact: true }).press('ArrowRight')
  await expect(page.locator('.crop-preview polygon')).not.toHaveAttribute('points', points!)
  // Four rotations preserve the manual selection instead of re-detecting a different region.
  const adjusted = await page.locator('.crop-preview polygon').getAttribute('points')
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Rotate', exact: true }).click()
  const afterRotate = await page.locator('.crop-preview polygon').getAttribute('points')
  const values = (value: string) => value.split(/[ ,]/).map(Number)
  values(adjusted!).forEach((value, i) => expect(values(afterRotate!)[i]).toBeCloseTo(value, 6))
  await page.getByRole('button', { name: 'Preview straightened page', exact: true }).click()
  await expect(page.getByAltText('Straightened page', { exact: true })).toBeVisible()
  await page.screenshot({ path: 'artifacts/scanner-auto-deskew.png', fullPage: true })
})

test('an unclear image asks for retake or corner selection instead of claiming automatic detection', async ({ page }) => {
  await openScanner(page, true)
  await expect(page.getByLabel('Detected page edges')).toHaveCount(0)
  await page.getByRole('button', { name: 'Capture page', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('The page edges are unclear')
  await expect(page.getByLabel('Page corners', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Retake', exact: true })).toBeVisible()
})

test('a failed OCR upload keeps the corner overlay aligned with the original capture', async ({ page }) => {
  await page.route('**/api/v1/documents/scan', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Try the upload again' }) }))
  await openScanner(page)
  await page.getByRole('button', { name: 'Capture page', exact: true }).click()
  await page.getByRole('button', { name: 'Read page', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Try the upload again')
  const size = await page.getByAltText('Captured page', { exact: true }).evaluate((img: HTMLImageElement) => ({ width: img.naturalWidth, height: img.naturalHeight }))
  expect(size).toEqual({ width: 960, height: 720 })
  await expect(page.getByLabel('Page corners', { exact: true })).toBeVisible()
})
