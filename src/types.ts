export type Point = {
  lat: number
  lng: number
}

export type AppState = {
  pointA: Point | null
  pointB: Point | null
  pointC: Point | null
  showPointC: boolean
}
