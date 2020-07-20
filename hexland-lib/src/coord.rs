/// Describes the co-ordinates of a tile along with
/// other helpful things.

mod square8;
mod tests;

use num::Integer;
use std::ops;

/// A tile co-ordinate.
#[derive(Clone, Copy, Eq, Hash, PartialEq)]
pub struct Coord {
    x: i32,
    y: i32,
}

impl Coord {
    /// Creates a new co-ordinate.
    pub fn new(x: i32, y: i32) -> Coord {
        Coord { x, y }
    }

    /// Returns the zero co-ordinate.
    pub fn zero() -> Coord {
        Coord { x: 0, y: 0 }
    }
}

impl ops::Add<Coord> for Coord {
    type Output = Coord;

    fn add(self, rhs: Coord) -> Coord {
        Coord::new(self.x + rhs.x, self.y + rhs.y)
    }
}

impl ops::AddAssign<Coord> for Coord {
    fn add_assign(&mut self, rhs: Coord) {
        self.x += rhs.x;
        self.y += rhs.y;
    }
}

impl ops::Mul<i32> for Coord {
    type Output = Coord;

    fn mul(self, rhs: i32) -> Coord {
        Coord::new(self.x * rhs, self.y * rhs)
    }
}

/// All co-ordinate systems can do this:
pub trait CoordSystem {
    /// Calculates the distance between two coords, which is always >=0,
    /// but may not be the sum of distances between the coords in between them.
    fn distance(a: &Coord, b: &Coord) -> i32;

    /// Creates a vector index for a coord; coords closer to the origin will
    /// have smaller indices and adjacent coords should be often put together.
    /// Each coord gets a unique index.
    fn index(c: &Coord) -> usize;

    /// Creates an iterator over the coords that are adjacent to this one.
    fn iter_adjacent(c: &Coord) -> Box<dyn Iterator<Item = Coord>>;
}

// Generates a coord from a spiral-order index.
fn rev_spiral_order(i: usize) -> Coord {
    let mut i_left = i;
    let mut i_mul = 1;
    let mut c = Coord::zero();
    loop {
        if i_left == 0 { break c };

        let i_here = i_left % 9;
        i_left /= 9;
        c += rev_spiral(i_here).unwrap() * i_mul;
        i_mul *= 3;
    }
}

/// Does spiral-order indexing starting at 0.  (Too slow?)
fn spiral_order(c: &Coord) -> usize {
    let zero = Coord::zero();
    let mut c_left = c.clone();
    let mut c_mul = 1;
    let mut i = 0;
    loop {
        if c_left == zero { break i };

        let c_here = Coord {
            x: (c_left.x + 1).mod_floor(&3) - 1,
            y: (c_left.y + 1).mod_floor(&3) - 1,
        };

        c_left.x = (c_left.x + 1).div_floor(&3);
        c_left.y = (c_left.y + 1).div_floor(&3);
        i += spiral(&c_here).unwrap() * c_mul;
        c_mul *= 9;
    }
}

/// Turns a value 0..9 into a coordinate between -1, -1 and 1, 1
fn rev_spiral(i: usize) -> Option<Coord> {
    match i { // written to match spiral order
        0 => Some(Coord::zero()),
        1 => Some(Coord::new(0, -1)),
        2 => Some(Coord::new(1, -1)),
        3 => Some(Coord::new(1, 0)),
        4 => Some(Coord::new(1, 1)),
        5 => Some(Coord::new(0, 1)),
        6 => Some(Coord::new(-1, 1)),
        7 => Some(Coord::new(-1, 0)),
        8 => Some(Coord::new(-1, -1)),
        _ => None,
    }
}

/// Turns a co-ordinate between -1, -1 and 1, 1 into a value 0..9
fn spiral(c: &Coord) -> Option<usize> {
    match (c.x, c.y) {
        (0, 0) => Some(0),
        (0, -1) => Some(1),
        (1, -1) => Some(2),
        (1, 0) => Some(3),
        (1, 1) => Some(4),
        (0, 1) => Some(5),
        (-1, 1) => Some(6),
        (-1, 0) => Some(7),
        (-1, -1) => Some(8),
        _ => None,
    }
}