# Genetic Programming — Symbolic Regression

A small, self-contained web app that demonstrates tree-based Genetic Programming (GP) solving symbolic regression. It evolves mathematical expression trees to approximate a chosen target function, and visualizes the best program, function fit, and fitness over time—all in the browser with plain JavaScript and Canvas.

Under the hood, each individual is an expression tree built from terminals (x and random constants) and operators (+, -, \*, /, sin, cos, abs, exp, log, sqrt). The engine uses tournament selection, subtree crossover, subtree mutation, and a touch of elitism. Fitness is mean squared error over evenly spaced sample points in the range [-3, 3], with protected operators and simple overflow guards to keep evaluations stable.

Using it is straightforward: open `index.html` in a modern browser. Pick a target function, tune GA parameters (population size, generations, mutation/crossover rates, max tree depth), and hit Start. While running, Start is disabled; you can Pause at any time, Reset to clear state, or simply press Start again after a run completes to begin a fresh evolution. The UI shows the current best tree, a plot comparing the target vs. evolved function, and a log-scale fitness chart for best and average scores per generation.

A handful of target functions are included to vary difficulty. Simple ones like sin(x), x², x²+x, abs(x), and x³−x help confirm the basics. More challenging options include Gaussian (e^−x²), damped oscillators, rational forms, step/sawtooth, sinc, multi-harmonic oscillators, logistic/tanh, exponential decay, a “bump” function, and multi‑modal mixtures.

The code lives in two files: `index.html` (layout/styles) and `app.js` (GP engine, UI wiring, and visualization). To add or rename target functions, update the dropdown in `index.html` and the `getTargetFunction()` map in `app.js`. No build step or external dependencies are required—serve it from any static HTTP server or open the HTML file directly.
