/// In the `square8` co-ordinate system, tiles are in a square grid with
/// each tile adjacent to all the others that share edges or vertices.

use crate::coord::*;

pub struct Square8 {
}

impl CoordSystem for Square8 {
    fn distance(a: &Coord, b: &Coord) -> i32 {
        // TODO Implement the D&D 3.5 style distance instead of the
        // Manhattan distance as here
        (a.x - b.x).abs() + (a.y - b.y).abs()
    }

    fn index(c: &Coord) -> usize {
        spiral_order(c)
    }

    fn iter_adjacent(c: &Coord) -> Box<dyn Iterator<Item = Coord>> {
        Box::new(Square8Adjacency { base: c.clone(), i: 0 })
    }
}

struct Square8Adjacency {
    base: Coord,
    i: usize,
}

impl Iterator for Square8Adjacency {
    type Item = Coord;

    fn next(&mut self) -> Option<Coord> {
        self.i += 1;
        Some(rev_spiral(self.i)? + self.base)
    }
}