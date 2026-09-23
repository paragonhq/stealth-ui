# Contributing

Stealth UI is written in the [stealth.pm](https://www.stealth.pm) source and exported to this repo, so the files here are generated. Pull requests are welcome and are carried over by hand.

A change is ready when the component:

- covers every state (hover, focus-visible, pressed, disabled, busy, error, empty),
- works from the keyboard and names itself to a screen reader,
- holds up at 390px wide, in both themes and with reduced motion,
- uses the tokens in `styles/stealth.css` and the values in `lib/motion.ts`, never raw colours or curves,
- has an example in `components/examples` with real-looking content.

Bugs and requests: [open an issue](https://github.com/paragonhq/stealth-ui/issues).
