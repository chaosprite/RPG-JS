import { HitObject } from './Hit'
import { random, intersection, generateUID } from './Utils'
import { RpgShape } from './Shape'

const buffer = new Map()

interface TileInfo {
    tiles: any[]
    hasCollision: boolean
    isClimbable?: boolean
    isOverlay: boolean
    objectGroups: HitObject[]
}

export default class RpgCommonMap {

    data: any
    width: number = 0
    height: number = 0
    tileWidth: number = 0
    tileHeight: number = 0
    layers: any[] = []
    private shapes: RpgShape[] = []

    static get buffer() {
        return buffer
    }

    load(data) {
        this.data = data
        this.width = data.width
        this.tileWidth = data.tileWidth 
        this.tileHeight = data.tileHeight
        this.height = data.height
        this.layers = data.layers
        this._extractShapes()
    }

    /** 
     * @title Width of the map in pixels
     * @prop {number} map.widthPx
     * @readonly
     * @memberof Map
     * */
    get widthPx(): number {
        return this.width * this.tileWidth
    }

    /** 
     * @title Height of the map in pixels
     * @prop {number} map.heightPx
     * @readonly
     * @memberof Map
     * */
    get heightPx(): number {
        return this.height * this.tileHeight
    }

    /** 
     * @title The depth of the map in pixels (this is the height of a tile ;))
     * @prop {number} map.zTileHeight
     * @readonly
     * @memberof Map
     * */
    get zTileHeight(): number {
        return this.tileHeight
    }

    _extractShapes() {
        for (let layer of this.layers) {
            if (layer.type != 'object') continue
            for (let obj of layer.objects) {
                this.createShape(obj)
            }
        }
    }

    /**
     * Create a shape dynamically on the map
     * 
     * Object:
     *  - (number) x: Position X
     *  - (number) y: Position Y
     *  - (number) width: Width
     *  - (number) height: Height
     *  - (object) properties (optionnal): 
     *      - (number) z: Position Z
     *      - (hexadecimal) color: Color (shared with client)
     *      - (boolean) collision
     *      - You can your own properties
     * 
     * @title Create Shape
     * @since beta.3
     * @method map.createShape(obj)
     * @param {object} obj
     * @returns {RpgShape}
     * @memberof Map
     */
    createShape(obj: HitObject): RpgShape {
        obj.name = (obj.name || generateUID()) as string
        obj.properties = obj.properties || {}
        const shape = new RpgShape(obj)
        this.shapes.push(shape)
        // trick to sync with client
        return this.shapes[this.shapes.length-1]
    }

    /**
     * Delete a shape
     * 
     * @title Get Shapes
     * @method map.removeShape(name)
     * @param {string} name Name of shape
     * @returns {void}
     * @memberof Map
     */
    removeShape(name: string) {
        // TODO: out players after delete shape
        this.shapes = this.shapes.filter(shape => shape.name != name)
    }

    /**
     * Return all shapes on the map
     * 
     * @title Get Shapes
     * @method map.getShapes()
     * @returns {RpgShape[]}
     * @memberof Map
     */
    getShapes(): RpgShape[] {
        return this.shapes
    }

    /**
     * Returns a shape by its name. Returns undefined is nothing is found
     * 
     * @title Get Shape by name
     * @method map.getShape(name)
     * @param {string} name Name of shape
     * @returns {RpgShape[] | undefine}
     * @memberof Map
     */
    getShape(name: string): RpgShape | undefined {
        return this.shapes.find(shape => shape.name == name)
    }
    
    getPositionByShape(filter: (shape: RpgShape) => {}): { x: number, y: number, z: number } | null {
        const startsFind = this.getShapes().filter(filter)
        if (startsFind.length) {
            const start = startsFind[random(0, startsFind.length-1)]
            return { x: start.hitbox.x, y: start.hitbox.y, z: start.properties.z * this.zTileHeight || 0 }
        }
        return null
    }

    /**
     * Get the tile index on the tileset
     * 
     * @title Get index of tile
     * @method map.getTileIndex(x,y)
     * @param {number} x Position X
     * @param {number} x Position Y
     * @returns {number}
     * @memberof Map
     */
    getTileIndex(x: number, y: number, [z] = [0]): number {
        return this.width * Math.floor((y - z) / this.tileHeight) + Math.floor(x / this.tileWidth)
    }

    /**
     * Retrieves tiles according to its index

     * @title Get index of tile
     * @method map.getTileByIndex(tileIndex)
     * @param {number} tileIndex tile index
     * @returns {TileInfo}
     * @example
     *  ```ts
     *  const index = map.getTileIndex(0, 0)
     *  const tiles = map.getTileByIndex(index)
     *  ```
     * @memberof Map
     */
    getTileByIndex(tileIndex: number, zPlayer: [number, number] = [0, 0]): TileInfo {
        const tiles: any[] = []
        for (let layer of this.layers) {
            if (layer.type != 'tile') {
                continue
            }
            const _tiles = layer.tiles[tileIndex]
            if (!_tiles) {
                continue
            }
            const zLayer = layer.properties.z
            const zTile = _tiles.properties.z
            let z, zIntersection
            if (zLayer !== undefined) {
                z = zLayer + (zTile !== undefined ? zTile : 0)
            }
            else if (zTile !== undefined) {
                z = zTile
            }
            if (z !== undefined) {
                const realZ = z * this.tileHeight
                zIntersection = intersection(zPlayer, [realZ, realZ + this.tileHeight])
            }
            if (zIntersection !== undefined) {
                if (zIntersection) tiles.push(_tiles)
            }
            else {
                tiles.push(_tiles)
            }
        }
        const getLastTile = tiles[tiles.length-1]
        if (!getLastTile) {
            return {
                tiles,
                hasCollision: true,
                isOverlay: false,
                objectGroups: []
            }
        }
        const hasCollision = getLastTile.properties.collision
        const isOverlay = getLastTile.properties.overlay
        const isClimbable = getLastTile.properties.climb
        const objectGroups = getLastTile.objectGroups
        return {
            tiles,
            hasCollision,
            isOverlay,
            objectGroups,
            isClimbable
        }
    }

    /**
     * Find the point of origin (top left) of a tile. Of course, its position depends on the size of the tile

     * @title Get origin position of tile
     * @method map.getTileOriginPosition(x,y)
     * @param {number} x Position X
     * @param {number} x Position Y
     * @returns { {x: number, y: number }}
     * @example
     *  ```ts
     *  // If the size of a tile is 32x32px
     *  const position = map.getTileOriginPosition(35, 12)
     *  console.log(position) // { x: 32, y: 0 }
     *  ```
     * @memberof Map
     */
    getTileOriginPosition(x: number, y: number): {
        x: number
        y: number
    } {
        return { 
            x: Math.floor(x / this.tileWidth) * this.tileWidth,
            y: Math.floor(y / this.tileHeight) * this.tileHeight
        }
    }

    /**
     * Recover tiles according to a position

     * @title Get index of tile
     * @method map.getTileByPosition(x,y)
     * @param {number} x Position X
     * @param {number} x Position Y
     * @returns {TileInfo}
     * @example
     *  ```ts
     *  const tiles = map.getTileByPosition(0, 0)
     *  ```
     * @memberof Map
     */
    getTileByPosition(x: number, y: number, z: [number, number] = [0, 0]): TileInfo {
        const tileIndex = this.getTileIndex(x, y, [z[0]])
        return this.getTileByIndex(tileIndex, z)
    }

}
