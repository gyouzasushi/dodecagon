const EPS = 1e-9;
const D = 40;
const MIN_Y = D * 2;
const GREEN1 = '#C6E48B';
const GREEN2 = '#7BC96F';
const svg = document.getElementById('svg');
type VerticesNumber = 3 | 4;

function sgn(x: number): number {
    return x < EPS ? -1 :
        x > EPS ? 1 :
            0;
}

class Point {
    x: number = 0;
    y: number = 0;
    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }
    add(p: Point) {
        this.x += p.x;
        this.y += p.y;
    }
    abs(): number {
        return Math.sqrt(this.x ** 2 + this.y ** 2);
    }
}
function add(a: Point, b: Point): Point {
    return new Point(a.x + b.x, a.y + b.y);
}
function sub(a: Point, b: Point): Point {
    return new Point(a.x - b.x, a.y - b.y);
}
function mul(a: Point, b: number): Point {
    return new Point(a.x * b, a.y * b);
}
function dot(a: Point, b: Point): number {
    return a.x * b.x + a.y * b.y;
}
function det(a: Point, b: Point): number {
    return a.x * b.y - b.x * a.y;
}
function dist(a: Point, b: Point): number {
    return sub(a, b).abs();
}
function isStrictlyCcw(a: Point, b: Point, c: Point): boolean {
    return sgn(det(sub(b, a), sub(c, a))) > 0;
}

class Segment {
    a: Point;
    b: Point;
    constructor(a: Point, b: Point) {
        this.a = a;
        this.b = b;
    }
    getCenter(): Point {
        return new Point((this.a.x + this.b.x) / 2, (this.a.y + this.b.y) / 2);
    }
}

const drag: {
    isMouseDown: boolean,
    target: Polygon | undefined,
    offset: Point,
} = {
    isMouseDown: false,
    target: undefined,
    offset: new Point(0, 0),
};
function getCursor(ev: MouseEvent): Point {
    return new Point(ev.clientX, ev.clientY);
}

class Polygon {
    static polygons: Array<Polygon> = [];
    static newId: number = 0;

    id: number;
    n: VerticesNumber;
    center: Point;
    theta: number;
    svg: SVGElement;
    isBaby: boolean = true;
    constructor(n: VerticesNumber, center: Point) {
        this.id = Polygon.newId++;
        this.n = n;
        this.center = center;
        this.theta = this.n === 3 ? (-Math.PI / 2) : (-Math.PI / 4);
        this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        this.svg.setAttribute('fill', this.n === 3 ? GREEN1 : GREEN2);
        this.svg.setAttribute('id', String(this.id));
        this.svg.setAttribute('stroke', 'white');
        this.svg.setAttribute('stroke-width', '1');
        this.svg.onmousedown = (ev: MouseEvent) => handleMouseDown(ev, this);
        svg?.appendChild(this.svg);
        this.draw();
        Polygon.polygons.push(this);
    }
    private getPoints(): Array<Point> {
        const r = D / (Math.sin(Math.PI / this.n) * 2);
        return [...Array(this.n)].map((_, i) =>
            new Point(
                this.center.x + r * Math.cos(this.theta + Math.PI * i * 2 / this.n),
                this.center.y + r * Math.sin(this.theta + Math.PI * i * 2 / this.n),
            )
        );
    }
    private getEdges(): Array<Segment> {
        const points = this.getPoints();
        return [...Array(this.n)].map((_, i) =>
            new Segment(
                points[i],
                points[(i + 1) % this.n],
            )
        );
    }

    private overlap(poly: Polygon): boolean {
        const ps = [this.getPoints(), poly.getPoints()];
        const es = [this.getEdges(), poly.getEdges()];
        for (let _ = 0; _ < 2; _++) {
            for (const e of es[0]) {
                let notOverlap = true;
                for (const p of ps[1]) {
                    notOverlap &&= !isStrictlyCcw(e.a, e.b, p);
                }
                if (notOverlap) return false;
            }
            [ps[0], ps[1]] = [ps[1], ps[0]];
            [es[0], es[1]] = [es[1], es[0]];
        }
        return true;
    }

    remove() {
        svg?.removeChild(this.svg);
        Polygon.polygons = Polygon.polygons.filter(
            poly => poly.id !== this.id
        );
    }

    fix() {
        let minDist: number = D * 2;
        let newCenter: Point | undefined = undefined;
        let newTheta: number | undefined = undefined;
        for (const e_from of this.getEdges()) {
            for (const poly of Polygon.polygons) {
                if (poly.id === this.id) continue;
                if (poly.isBaby) continue;
                for (const e_to of poly.getEdges()) {
                    const nowDist = dist(e_from.getCenter(), e_to.getCenter());
                    if (sgn(nowDist - minDist) < 0) {
                        const h1 = D / (2 * Math.tan(Math.PI / this.n));
                        const h2 = D / (2 * Math.tan(Math.PI / poly.n));
                        const oldCenter = this.center;
                        const oldTheta = this.theta;
                        this.center = add(e_to.getCenter(), mul(sub(e_to.getCenter(), poly.center), h1 / h2));
                        this.theta = Math.atan2(e_to.b.y - this.center.y, e_to.b.x - this.center.x);
                        let ok = true;
                        for (const poly_ of Polygon.polygons) {
                            if (poly_.id === this.id) continue;
                            ok &&= !this.overlap(poly_);
                        }
                        if (ok) {
                            minDist = nowDist;
                        } else {
                            this.center = oldCenter;
                            this.theta = oldTheta;
                        }
                    }
                }
            }
        }
        this.draw();
    }

    draw() {
        const points = this.getPoints();
        this.svg.setAttribute('points', [...Array(this.n)].map((_, i) =>
            [
                points[i].x,
                points[i].y,
            ]
        ).flat().join(' '));
    }
}
function handleMouseDown(ev: MouseEvent, poly: Polygon) {
    svg?.removeChild(poly.svg);
    svg?.appendChild(poly.svg);
    drag.target = poly;
    drag.offset = sub(getCursor(ev), poly.center);
    drag.isMouseDown = true;
}

document.onmousemove = function (ev: MouseEvent) {
    if (!drag.isMouseDown) return;
    if (drag.target === undefined) return;
    drag.target.center = sub(getCursor(ev), drag.offset);
    drag.target.draw();
};

document.onmouseup = function (ev: MouseEvent) {
    if (drag.target === undefined) return;
    drag.isMouseDown = false;

    if (drag.target.center.y < MIN_Y) {
        drag.target.remove();
    } else {
        drag.target.fix();
    }

    if (drag.target.isBaby) {
        drag.target.isBaby = false;
        createNewPolygon(drag.target.n);
    }

    drag.target = undefined;
};

function createNewPolygon(n: VerticesNumber) {

    new Polygon(n, n === 3 ?
        new Point(20, 20 + D * (1 - Math.sqrt(3) / 2)) :
        new Point(100, 20)
    );
}
createNewPolygon(3);
createNewPolygon(4);