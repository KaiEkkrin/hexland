#[cfg(test)]
extern crate quickcheck;

#[cfg(test)]
mod tests {
    use crate::coord::*;

    #[quickcheck]
    fn rev_spiral_order_is_unique(a: usize, b: usize) -> bool {
        let coord_a = rev_spiral_order(a);
        let coord_b = rev_spiral_order(b);
        (coord_a == coord_b) == (a == b)
    }

    #[quickcheck]
    fn spiral_order_reverses_to_original(x: i32, y: i32) -> bool {
        let c = Coord::new(x, y);
        let index = spiral_order(&c);
        let c2 = rev_spiral_order(index);
        c == c2
    }
}
