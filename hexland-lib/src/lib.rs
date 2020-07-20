#[cfg(test)]
#[macro_use(quickcheck)]
extern crate quickcheck_macros;

mod coord;

#[cfg(test)]
mod tests {
    #[test]
    fn it_works() {
        assert_eq!(2 + 2, 4);
    }
}
