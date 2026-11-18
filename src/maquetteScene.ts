import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { MapProps, Marker } from './Map.tsx'
import { lines, stations, type LineId } from './scenario.ts'

export type CameraAction = 'left' | 'right' | 'closer' | 'farther' | 'top' | 'perspective'
const ink = '#273e45'
const floor = '#e7e1cb'
const azimuth = new THREE.Vector3(1.9, 8.9, 5.9)
const up = new THREE.Vector3(0, 1, 0)

function point(x: number, y: number, height = 0) {
  return new THREE.Vector3((x - 425) / 100, height, (y - 244) / 100)
}

function box(w: number, h: number, d: number, color: string, x: number, y: number, z: number) {
  const object = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({color, roughness: .87}))
  object.position.set(x, y, z)
  object.receiveShadow = true
  return object
}

function disk(radius: number, height: number, color: string, sides = 32) {
  const object = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, sides),
    new THREE.MeshStandardMaterial({ color, roughness: .8 }))
  object.receiveShadow = true
  return object
}

function free(group: THREE.Object3D) {
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return
    object.geometry.dispose()
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose()
  })
  group.clear()
}

const blocks = [
  [80, 70, .40, .3], [166, 72, .56, .36], [222, 177, .68, .36], [116, 212, .46, .4],
  [70, 307, .42, .38], [235, 411, .66, .32], [343, 363, .65, .42], [290, 251, .42, .32],
  [559, 70, .55, .33], [708, 67, .50, .40], [753, 130, .6, .38], [627, 235, .7, .36],
  [723, 217, .42, .4], [665, 323, .5, .4], [740, 404, .63, .45], [528, 431, .52, .42],
]
const parks = [[597, 68], [767, 353], [74, 447]]
const river = new THREE.CubicBezierCurve(
  new THREE.Vector2(4.9, 0), new THREE.Vector2(5.52, 1.34),
  new THREE.Vector2(3.72, 3.2), new THREE.Vector2(4.51, 4.88),
).getPoints(26)

function cityModel() {
  const city = new THREE.Group()
  city.add(
    box(8.68, .26, 5.06, '#3b5556', 0, -.25, 0),
    box(8.54, .13, 4.92, '#b6a78e', 0, -.11, 0),
    box(8.5, .07, 4.88, floor, 0, -.035, 0),
    box(23, .1, 19, '#d9d1bd', 0, -.44, 0),
  )
  const shape = new THREE.Shape()
  river.forEach(({ x, y }, index) => {
    if (index === 0) shape.moveTo(x - 4.25 - .36, 2.44 - y)
    else shape.lineTo(x - 4.25 - .36, 2.44 - y)
  })
  for (const { x, y } of [...river].reverse()) shape.lineTo(x - 4.25 + .36, 2.44 - y)
  shape.closePath()
  const water = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({ color: '#92b5b6', roughness: .58 }))
  water.rotation.x = -Math.PI / 2
  water.position.y = .013
  water.receiveShadow = true
  city.add(water)
  for (const [x, y] of parks) {
    const position = point(x, y)
    const park = disk(.30, .027, '#aab89b', 8)
    park.position.copy(position)
    city.add(park)
    for (const [dx, dz] of [[-.11, .03], [.1, .08], [.02, -.12]]) {
      const tree = disk(.048, .11, '#899e88', 7)
      tree.position.set(position.x + dx, .069, position.z + dz)
      tree.castShadow = true
      city.add(tree)
    }
  }
  const buildings = blocks.map(([x, y, w, d], index) => {
    const p = point(x, y)
    const height = .12 + (index % 3) * .041
    const piece = new THREE.Group()
    piece.position.copy(p)
    const shell = box(w, height, d, index % 2 ? '#c3baaa' : '#d4c8b1', 0, height / 2, 0)
    shell.castShadow = true
    piece.add(
      box(w + .14, .02, d + .16, '#d1c6ae', 0, .015, 0),
      shell,
      box(w + .055, .038, d + .047, '#b3aea2', 0, height + .02, 0),
      box(w * .38, .027, d * .38, '#e6dbc7', -.05, height + .052, .035),
    )
    for (const dx of [-.25, 0, .25]) piece.add(box(.063, .042, .007, '#7b8b89', dx * w, height * .57, d / 2 + .003))
    city.add(piece)
    return { piece, x, y, clearance: Math.hypot(w, d) * 50 + 11 }
  })

  const venue = new THREE.Group()
  venue.position.copy(point(335, 71))
  venue.add(box(1.01, .035, .78, '#cebfa5', 0, .018, 0))
  for (const [radius, height, level, color] of [
    [.41, .20, .12, '#ae8a6e'], [.44, .060, .247, '#f0d3a0'], [.36, .045, .293, '#9a7764'],
  ] as const) {
    const ring = disk(radius, height, color, 8)
    ring.position.y = level
    ring.castShadow = true
    venue.add(ring)
  }
  venue.add(
    box(.32, .12, .13, '#4e635f', 0, .091, .39),
    box(.43, .043, .21, '#dfbc87', 0, .175, .40),
    box(.026, .10, .022, '#eddac1', -.155, .093, .48),
    box(.026, .10, .022, '#eddac1', .155, .093, .48),
  )
  city.add(venue)
  return { city, buildings }
}

function distanceToSegment(x: number, y: number, from: {x: number; y: number}, to: {x: number; y: number}) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const fraction = THREE.MathUtils.clamp(((x - from.x) * dx + (y - from.y) * dy) / (dx * dx + dy * dy || 1), 0, 1)
  return Math.hypot(x - from.x - dx * fraction, y - from.y - dy * fraction)
}

function strip(from: THREE.Vector3, to: THREE.Vector3, width: number, color: string) {
  const midpoint = from.clone().lerp(to, .5)
  const mesh = box(from.distanceTo(to), .022, width, color, midpoint.x, midpoint.y, midpoint.z)
  mesh.rotation.y = -Math.atan2(to.z - from.z, to.x - from.x)
  return mesh
}

function carriage(id: LineId) {
  const train = new THREE.Group()
  const color = lines.find(line => line.id === id)!.color
  const bottom = box(.35, .055, .14, ink, 0, .093, 0)
  bottom.castShadow = true
  train.add(bottom,
    box(.33, .11, .128, '#fff5dc', 0, .155, 0),
    box(.35, .039, .145, color, 0, .22, 0),
    box(.069, .06, .134, '#3a535a', .137, .164, 0),
  )
  for (const x of [-.092, .008]) train.add(box(.067, .041, .139, '#3a535a', x, .165, 0))
  return train
}

type SceneOptions = {
  getMap: () => MapProps
  onFailure: () => void
}
export function mountMaquette(host: HTMLDivElement, overlay: HTMLDivElement, { getMap, onFailure }: SceneOptions) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.setClearColor('#d9d1bd')
  const canvas = renderer.domElement
  canvas.setAttribute('aria-hidden', 'true')
  host.append(canvas)
  canvas.addEventListener('webglcontextlost', onFailure)
  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-6, 6, 4, -4, .05, 55)
  camera.position.copy(azimuth)
  const controls = new OrbitControls(camera, canvas)
  controls.enablePan = false
  controls.minZoom = .72
  controls.maxZoom = 2.7
  controls.maxPolarAngle = Math.PI * .40
  controls.update()
  const motion = matchMedia('(prefers-reduced-motion: reduce)')
  const light = new THREE.DirectionalLight('#fff0d5', 2.1)
  light.position.set(-5, 8, -3)
  light.castShadow = true
  light.shadow.mapSize.set(1024, 1024)
  light.shadow.camera.left = -6
  light.shadow.camera.right = 6
  light.shadow.camera.top = 5
  light.shadow.camera.bottom = -5
  light.shadow.normalBias = .018
  scene.add(light, new THREE.HemisphereLight('#fff9ed', '#8a9384', 2.25))
  const { city, buildings } = cityModel()
  const network = new THREE.Group()
  scene.add(city, network)
  const cars = new Map<LineId, THREE.Group>()
  const groundLabels = new THREE.Vector3()
  const shift = new THREE.Vector3()
  let width = 1
  let height = 1
  let frame = 0
  let key = ''
  let last: MapProps | undefined
  let dirty = true
  let previousFollowing: LineId | null = null
  let time = performance.now()

  const resize = new ResizeObserver(() => {
    width = Math.max(host.clientWidth, 1)
    height = Math.max(host.clientHeight, 1)
    const aspect = width / height
    const span = Math.max(10.05, 6.5 * aspect)
    camera.left = -span / 2
    camera.right = span / 2
    camera.top = span / aspect / 2
    camera.bottom = -camera.top
    camera.updateProjectionMatrix()
    renderer.setSize(width, height, false)
    dirty = true
  })
  resize.observe(host)
  controls.addEventListener('change', () => { dirty = true })

  function drawNetwork(map: MapProps) {
    const signature = JSON.stringify([map.routes, map.draft, map.pending])
    if (signature === key) return
    key = signature
    free(network)
    const byId = new Map(stations.map(station => [station.id, station]))
    const segments = [...map.routes, ...map.pending, ...(map.draft ? [map.draft] : [])].flatMap(route =>
      route.stops.slice(1).map((id, index) => [byId.get(route.stops[index])!, byId.get(id)!] as const))
    for (const { piece, x, y, clearance } of buildings)
      piece.visible = !segments.some(([a, b]) => distanceToSegment(x, y, a, b) < clearance)
    map.routes.forEach((route, index) => {
      const height = .045 + index * .022
      const color = lines.find(line => line.id === route.id)!.color
      route.stops.slice(1).forEach((id, i) => {
        const a = byId.get(route.stops[i])!
        const b = byId.get(id)!
        const from = point(a.x, a.y, height)
        const to = point(b.x, b.y, height)
        network.add(strip(from, to, .12, '#f6edd6'), strip(from.clone().addScaledVector(up, .014), to.clone().addScaledVector(up, .014), .067, color))
      })
    })
    for (const route of [...map.pending, ...(map.draft ? [map.draft] : [])]) {
      route.stops.slice(1).forEach((id, i) => {
        const a = byId.get(route.stops[i])!
        const b = byId.get(id)!
        const from = point(a.x, a.y, .088)
        const to = point(b.x, b.y, .088)
        const length = from.distanceTo(to)
        const n = Math.max(1, Math.round(length / .18))
        const offset = new THREE.Vector3(to.z - from.z, 0, from.x - to.x).normalize().multiplyScalar(.12)
        from.add(offset)
        to.add(offset)
        for (let j = 0; j < n; j++) network.add(strip(from.clone().lerp(to, j / n),
          from.clone().lerp(to, (j + .57) / n), .045, '#633d82'))
      })
    }
    for (const station of stations) {
      const platform = disk(.125, .045, '#fff1d4', 12)
      platform.position.copy(point(station.x, station.y, .055))
      network.add(platform)
    }
  }

  function placeCar(marker: Marker, ease: number) {
    let object = cars.get(marker.id)
    const target = point(marker.x, marker.y)
    if (!object) {
      object = carriage(marker.id)
      object.position.copy(target)
      scene.add(object)
      cars.set(marker.id, object)
    }
    object.position.lerp(target, object.position.distanceTo(target) > .65 ? 1 : ease)
    object.rotation.y = -THREE.MathUtils.degToRad(marker.angle)
    return object
  }

  function projectLabels() {
    camera.updateMatrixWorld()
    for (const label of overlay.querySelectorAll<HTMLElement>('[data-x][data-y]')) {
      groundLabels.copy(point(Number(label.dataset.x), Number(label.dataset.y), Number(label.dataset.h ?? '.12'))).project(camera)
      label.style.left = (groundLabels.x + 1) * width / 2 + 'px'
      label.style.top = (1 - groundLabels.y) * height / 2 + 'px'
      label.style.visibility = Math.abs(groundLabels.x) > 1.02 || Math.abs(groundLabels.y) > 1.02 ? 'hidden' : 'visible'
    }
  }

  function animate(now: number) {
    frame = requestAnimationFrame(animate)
    const delta = Math.min(.08, (now - time) / 1000)
    time = now
    const map = getMap()
    controls.enableDamping = !motion.matches
    controls.update()
    if (map.following !== previousFollowing && !map.following) {
      camera.position.sub(controls.target)
      controls.target.set(0, 0, 0)
      controls.update()
    }
    previousFollowing = map.following
    if (map === last && !dirty && !map.moving) return
    last = map
    dirty = false
    drawNetwork(map)
    const ease = motion.matches || !map.moving ? 1 : 1 - Math.exp(-22 * delta)
    for (const marker of map.markers) placeCar(marker, ease)
    for (const [id, object] of cars) {
      if (!map.markers.some(marker => marker.id === id)) {
        scene.remove(object)
        free(object)
        cars.delete(id)
      }
    }
    const followed = map.following ? cars.get(map.following) : undefined
    if (followed) {
      shift.copy(followed.position).sub(controls.target)
      controls.target.add(shift)
      camera.position.add(shift)
      controls.update()
    }
    for (const label of overlay.querySelectorAll<HTMLElement>('[data-train]')) {
      const car = cars.get(label.dataset.train as LineId)
      if (!car) continue
      label.dataset.x = String(car.position.x * 100 + 425)
      label.dataset.y = String(car.position.z * 100 + 244)
    }
    projectLabels()
    renderer.render(scene, camera)
  }
  frame = requestAnimationFrame(animate)

  return {
    act(action: CameraAction) {
      const offset = camera.position.clone().sub(controls.target)
      if (action === 'top' || action === 'perspective') {
        controls.target.set(0, 0, 0)
        camera.position.copy(action === 'top' ? new THREE.Vector3(0, 10, .001) : azimuth)
        camera.zoom = 1
      } else if (action === 'left' || action === 'right') {
        camera.position.copy(offset.applyAxisAngle(up, action === 'left' ? -.30 : .30).add(controls.target))
      } else {
        camera.zoom = THREE.MathUtils.clamp(camera.zoom * (action === 'closer' ? 1.18 : 1 / 1.18), controls.minZoom, controls.maxZoom)
      }
      camera.updateProjectionMatrix()
      controls.update()
      dirty = true
    },
    dispose() {
      cancelAnimationFrame(frame)
      resize.disconnect()
      canvas.removeEventListener('webglcontextlost', onFailure)
      controls.dispose()
      free(scene)
      light.shadow.dispose()
      renderer.dispose()
      canvas.remove()
    },
  }
}
