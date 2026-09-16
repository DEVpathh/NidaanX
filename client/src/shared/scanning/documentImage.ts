export type Point = { x: number; y: number }
export const defaultCorners = (): Point[] => [{x:.08,y:.06},{x:.92,y:.06},{x:.92,y:.94},{x:.08,y:.94}]
export type DocumentDetection = { corners: Point[]; confidence: number }

const cross = (a: Point, b: Point, c: Point) => (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)
const distance = (a: Point, b: Point) => Math.hypot(a.x-b.x, a.y-b.y)
const polygonArea = (points: Point[]) => Math.abs(points.reduce((sum, p, i) => {
  const next = points[(i+1)%points.length]!
  return sum + p.x*next.y - next.x*p.y
}, 0))/2

function convexHull(points: Point[]): Point[] {
  points.sort((a,b) => a.x-b.x || a.y-b.y)
  const lower: Point[] = [], upper: Point[] = []
  for (const p of points) {
    while (lower.length > 1 && cross(lower[lower.length-2]!, lower[lower.length-1]!, p) <= 0) lower.pop()
    lower.push(p)
  }
  for (let i = points.length-1; i >= 0; i--) {
    const p = points[i]!
    while (upper.length > 1 && cross(upper[upper.length-2]!, upper[upper.length-1]!, p) <= 0) upper.pop()
    upper.push(p)
  }
  return lower.slice(0,-1).concat(upper.slice(0,-1))
}

// Remove raster stair-steps in pixel coordinates, not normalized coordinates:
// normalized x+y extrema can duplicate corners or distort a rotated portrait page.
function fitQuadrilateral(hull: Point[]): Point[] | null {
  if (hull.length < 4) return null
  const points = hull.slice()
  while (points.length > 4) {
    let remove = 0, leastArea = Infinity
    for (let i = 0; i < points.length; i++) {
      const area = Math.abs(cross(points[(i+points.length-1)%points.length]!, points[i]!, points[(i+1)%points.length]!))
      if (area < leastArea) { leastArea = area; remove = i }
    }
    points.splice(remove,1)
  }
  // A circular reflection has a large hull, but cannot be explained by four sides.
  if (polygonArea(points)/polygonArea(hull) < .88) return null
  return points
}

/** Returns no detection rather than presenting a guessed inset as a detected page. */
export function detectDocument(canvas: HTMLCanvasElement): DocumentDetection | null {
  if (canvas.width < 20 || canvas.height < 20) return null
  const scale = Math.min(1, 320/Math.max(canvas.width,canvas.height))
  const small = document.createElement('canvas')
  small.width = Math.max(1,Math.round(canvas.width*scale))
  small.height = Math.max(1,Math.round(canvas.height*scale))
  const ctx = small.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(canvas,0,0,small.width,small.height)
  const pixels = ctx.getImageData(0,0,small.width,small.height)
  return detectDocumentPixels(pixels.data,pixels.width,pixels.height)
}

/** Pixel entry point also permits deterministic detector tests without a camera. */
export function detectDocumentPixels(data: Uint8ClampedArray, width: number, height: number): DocumentDetection | null {
  if (width < 20 || height < 20 || data.length !== width*height*4) return null
  const size = width*height, minimumArea = size*.075
  const luminance = new Float32Array(size), neutral = new Uint8Array(size), histogram = new Uint32Array(256)
  for (let i = 0; i < size; i++) {
    const r = data[i*4]!, g = data[i*4+1]!, b = data[i*4+2]!
    const l = .299*r+.587*g+.114*b
    luminance[i] = l
    neutral[i] = Number(Math.max(r,g,b)-Math.min(r,g,b) < Math.max(50,l*.45))
    histogram[Math.round(l)]!++
  }
  const percentile = (fraction: number) => {
    let count = 0
    for (let i = 0; i < 256; i++) { count += histogram[i]!; if (count >= size*fraction) return i }
    return 255
  }
  if (percentile(.98)-percentile(.02) < 8) return null

  // Light paper can be shaded or warm in camera images. Multiple thresholds let
  // its complete boundary compete with the brightly lit portion and background.
  const thresholds = new Set([70,110,150,185,215,235, ...[.2,.4,.6,.8].map(p => Math.max(25,percentile(p)-8))])
  const masks: Uint8Array[] = []
  for (const threshold of thresholds) {
    const mask = new Uint8Array(size)
    for (let i = 0; i < size; i++) mask[i] = Number(luminance[i]! >= threshold && neutral[i])
    masks.push(mask)
  }

  // An enclosed edge region supplies a second candidate source. This finds the
  // whole page on a pale desk and under uneven illumination, where a brightness
  // component alone either merges into the desk or cuts across the paper.
  const blurred = new Float32Array(size), gradient = new Float32Array(size)
  for (let y = 1; y < height-1; y++) for (let x = 1; x < width-1; x++) {
    const i = y*width+x
    blurred[i] = (luminance[i-width-1]!+2*luminance[i-width]!+luminance[i-width+1]!+
      2*luminance[i-1]!+4*luminance[i]!+2*luminance[i+1]!+
      luminance[i+width-1]!+2*luminance[i+width]!+luminance[i+width+1]!)/16
  }
  for (let y = 2; y < height-2; y++) for (let x = 2; x < width-2; x++) {
    const i = y*width+x
    const dx = blurred[i-width+1]!+2*blurred[i+1]!+blurred[i+width+1]!-blurred[i-width-1]!-2*blurred[i-1]!-blurred[i+width-1]!
    const dy = blurred[i+width-1]!+2*blurred[i+width]!+blurred[i+width+1]!-blurred[i-width-1]!-2*blurred[i-width]!-blurred[i-width+1]!
    gradient[i] = Math.hypot(dx,dy)/4
  }
  for (const threshold of [7,16]) {
    const mask = new Uint8Array(size)
    for (let y = 2; y < height-2; y++) for (let x = 2; x < width-2; x++) {
      const i = y*width+x
      // Closing small contour gaps by dilating the boundary keeps page interiors
      // separate from the desk, including lightly printed document edges.
      mask[i] = Number(Math.max(gradient[i]!,gradient[i-1]!,gradient[i+1]!,gradient[i-width]!,gradient[i+width]!) < threshold)
    }
    masks.push(mask)
  }

  const sample = (x: number, y: number): number | null => {
    if (x < 1 || y < 1 || x >= width-1 || y >= height-1) return null
    return luminance[Math.round(y)*width+Math.round(x)]!
  }
  let best: DocumentDetection | null = null, bestScore = 0
  const queue = new Int32Array(size)

  const evaluate = (quad: Point[], hull: Point[], count: number) => {
    const area = polygonArea(quad)
    if (area < minimumArea || area > size*.96 || count/polygonArea(hull) < .64) return
    const lengths = quad.map((p,i) => distance(p,quad[(i+1)%4]!))
    if (Math.min(...lengths) < Math.min(width,height)*.12 || Math.max(...lengths)/Math.min(...lengths) > 5) return
    for (let i = 0; i < 4; i++) {
      const a = quad[(i+3)%4]!, b = quad[i]!, c = quad[(i+1)%4]!
      const sine = cross(a,b,c)/(distance(a,b)*distance(b,c))
      if (sine < .25) return
    }

    // Fit each side to the nearby visible boundary. Edge-region hulls lie a few
    // pixels inside the page after dilation; recovering that offset also prevents
    // clipping the outer text. Sustained support rejects isolated bright objects.
    const sides: { x: number; y: number; nx: number; ny: number }[] = []
    const supports: number[] = [], contrasts: number[] = []
    for (let side = 0; side < 4; side++) {
      const a = quad[side]!, b = quad[(side+1)%4]!, length = lengths[side]!
      const nx = -(b.y-a.y)/length, ny = (b.x-a.x)/length
      let strongest = -Infinity, offset = 0, support = 0, contrast = 0
      for (let shift = -5; shift <= 3; shift++) {
        let strength = 0, supported = 0, signed = 0, samples = 0
        for (let j = 2; j <= 22; j++) {
          const t = j/24, x = a.x+(b.x-a.x)*t+nx*shift, y = a.y+(b.y-a.y)*t+ny*shift
          const inside = sample(x+nx*2.5,y+ny*2.5), outside = sample(x-nx*2.5,y-ny*2.5)
          if (inside === null || outside === null) continue
          const difference = inside-outside
          strength += Math.min(80,Math.abs(difference))
          signed += difference
          supported += Number(Math.abs(difference) >= 9)
          samples++
        }
        const value = samples >= 16 ? strength/samples-Math.abs(shift)*.35 : -Infinity
        if (value > strongest) { strongest = value; offset = shift; support = supported/21; contrast = signed/Math.max(1,samples) }
      }
      sides.push({x:a.x+nx*offset,y:a.y+ny*offset,nx,ny})
      supports.push(support)
      contrasts.push(contrast)
    }
    const meanSupport = supports.reduce((a,b) => a+b,0)/4, weakestSupport = Math.min(...supports)
    if (weakestSupport < .4 || meanSupport < .64) return
    const refined: Point[] = []
    for (let i = 0; i < 4; i++) {
      const a = sides[(i+3)%4]!, b = sides[i]!
      const determinant = a.nx*b.ny-a.ny*b.nx
      if (Math.abs(determinant) < .1) return
      const c = a.nx*a.x+a.ny*a.y, d = b.nx*b.x+b.ny*b.y
      const x = (c*b.ny-a.ny*d)/determinant, y = (a.nx*d-c*b.nx)/determinant
      if (x < 0 || y < 0 || x > width-1 || y > height-1) return
      refined.push({x,y})
    }
    const lightSides = contrasts.filter(c => c >= -5).length
    if (lightSides < 2) return
    const confidence = Math.min(.99,.5*meanSupport+.25*weakestSupport+.15*Math.min(1,area/(size*.3))+.1*(polygonArea(quad)/polygonArea(hull)))
    // Prefer a complete large page over its smaller lit portion, without making
    // central placement a requirement (documents can be legitimately off-center).
    const score = confidence*Math.sqrt(area/size)
    if (score <= bestScore) return
    let start = 0
    for (let i = 1; i < 4; i++) if (refined[i]!.x+refined[i]!.y < refined[start]!.x+refined[start]!.y) start = i
    bestScore = score
    best = { confidence, corners: Array.from({length:4},(_,i) => {
      const p = refined[(start+i)%4]!
      return {x:p.x/(width-1),y:p.y/(height-1)}
    }) }
  }

  for (const mask of masks) {
    for (let start = 0; start < size; start++) {
      if (!mask[start]) continue
      let head = 0, tail = 1
      queue[0] = start; mask[start] = 0
      const boundary: Point[] = []
      let left = width, right = 0, top = height, bottom = 0
      while (head < tail) {
        const i = queue[head++]!, x = i%width, y = Math.floor(i/width)
        left = Math.min(left,x); right = Math.max(right,x); top = Math.min(top,y); bottom = Math.max(bottom,y)
        for (const next of [x>0 ? i-1 : -1,x<width-1 ? i+1 : -1,y>0 ? i-width : -1,y<height-1 ? i+width : -1]) {
          if (next >= 0 && mask[next]) { mask[next] = 0; queue[tail++] = next }
        }
      }
      if (tail < minimumArea || tail > size*.96 || (left <= 2 && right >= width-3 && top <= 2 && bottom >= height-3)) continue
      // Row extrema suffice for the convex hull and avoid sorting every pixel.
      const rowLeft = new Int32Array(bottom-top+1).fill(width), rowRight = new Int32Array(bottom-top+1).fill(-1)
      for (let j = 0; j < tail; j++) {
        const i = queue[j]!, x = i%width, row = Math.floor(i/width)-top
        rowLeft[row] = Math.min(rowLeft[row]!,x); rowRight[row] = Math.max(rowRight[row]!,x)
      }
      for (let row = 0; row < rowLeft.length; row++) if (rowRight[row]! >= 0) {
        boundary.push({x:rowLeft[row]!,y:row+top},{x:rowRight[row]!,y:row+top})
      }
      const hull = convexHull(boundary), quad = fitQuadrilateral(hull)
      if (quad) evaluate(quad,hull,tail)
    }
  }
  return best
}

/** Legacy caller fallback; new capture flows should use detectDocument. */
export function detectPaper(canvas: HTMLCanvasElement): Point[] {
  return detectDocument(canvas)?.corners ?? defaultCorners()
}
function solve(matrix: number[][]): number[] {
  for(let col=0;col<8;col++) {
    let pivot=col
    for(let row=col+1;row<8;row++) if(Math.abs(matrix[row]![col]!)>Math.abs(matrix[pivot]![col]!)) pivot=row
    const swap=matrix[col]!;matrix[col]=matrix[pivot]!;matrix[pivot]=swap
    const current=matrix[col]!,n=current[col]!
    if(Math.abs(n)<1e-10)throw new Error('Move the four corners to the page edges.')
    for(let j=col;j<9;j++)current[j]=current[j]!/n
    for(let row=0;row<8;row++)if(row!==col){const other=matrix[row]!,k=other[col]!;for(let j=col;j<9;j++)other[j]=other[j]!-k*current[j]!}
  }
  return matrix.map(row=>row[8]!)
}
export function rectify(canvas: HTMLCanvasElement, corners: Point[]): HTMLCanvasElement {
  if(corners.length!==4)throw new Error('Four page corners are required.')
  if(canvas.width<2||canvas.height<2||corners.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>1||p.y<0||p.y>1))throw new Error('Keep all four corners inside the captured image.')
  const cross=corners.map((a,i)=>{const b=corners[(i+1)%4]!,c=corners[(i+2)%4]!;return(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x)})
  if(cross.some(n=>n<.002))throw new Error('Keep the corners in order: top left, top right, bottom right, bottom left.')
  const p=corners.map(c=>({x:c.x*(canvas.width-1),y:c.y*(canvas.height-1)}))
  const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y)
  let w=Math.max(distance(p[0]!,p[1]!),distance(p[3]!,p[2]!)),h=Math.max(distance(p[0]!,p[3]!),distance(p[1]!,p[2]!))
  const scale=Math.min(1,1800/Math.max(w,h));w=Math.round(w*scale);h=Math.round(h*scale)
  if(w<100||h<100)throw new Error('Move closer and include the entire page.')
  const targets=[{x:0,y:0},{x:w-1,y:0},{x:w-1,y:h-1},{x:0,y:h-1}]
  const matrix=targets.flatMap(({x:u,y:v},i)=>{const{x,y}=p[i]!;return[[u,v,1,0,0,0,-u*x,-v*x,x],[0,0,0,u,v,1,-u*y,-v*y,y]]})
  const a=solve(matrix),src=canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height)
  const out=document.createElement('canvas');out.width=w;out.height=h
  const ctx=out.getContext('2d')!,dest=ctx.createImageData(w,h)
  for(let v=0;v<h;v++)for(let u=0;u<w;u++) {
    const denom=a[6]!*u+a[7]!*v+1, x=Math.max(0,Math.min(canvas.width-1,(a[0]!*u+a[1]!*v+a[2]!)/denom)),y=Math.max(0,Math.min(canvas.height-1,(a[3]!*u+a[4]!*v+a[5]!)/denom))
    const x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(x0+1,canvas.width-1),y1=Math.min(y0+1,canvas.height-1),dx=x-x0,dy=y-y0,index=(v*w+u)*4
    for(let c=0;c<3;c++){const value=src.data[(y0*canvas.width+x0)*4+c]!*(1-dx)*(1-dy)+src.data[(y0*canvas.width+x1)*4+c]!*dx*(1-dy)+src.data[(y1*canvas.width+x0)*4+c]!*(1-dx)*dy+src.data[(y1*canvas.width+x1)*4+c]!*dx*dy;dest.data[index+c]=Math.max(0,Math.min(255,(value-128)*1.08+128))}dest.data[index+3]=255
  }
  ctx.putImageData(dest,0,0);return out
}
export function rotatePage(canvas: HTMLCanvasElement) {
  const out=document.createElement('canvas');out.width=canvas.height;out.height=canvas.width
  const ctx=out.getContext('2d')!;ctx.translate(out.width,0);ctx.rotate(Math.PI/2);ctx.drawImage(canvas,0,0);return out
}
