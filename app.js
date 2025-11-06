/* Genetic Programming Symbolic Regression */

// ====== Drawer and Modal Setup (from template) ======
(function setupDrawer() {
  const sidebar = document.getElementById("sidebar");
  const openBtn = document.getElementById("menu-toggle");
  const backdrop = document.getElementById("backdrop");
  const mq = window.matchMedia("(max-width: 900px)");
  function closeDrawer() {
    sidebar && sidebar.classList.remove("open");
    backdrop && backdrop.classList.remove("show");
  }
  function openDrawer() {
    sidebar && sidebar.classList.add("open");
    backdrop && backdrop.classList.add("show");
  }
  openBtn &&
    openBtn.addEventListener("click", () => {
      if (sidebar.classList.contains("open")) closeDrawer();
      else openDrawer();
    });
  backdrop && backdrop.addEventListener("click", closeDrawer);
  window.addEventListener("resize", () => {
    if (!mq.matches) closeDrawer();
  });
})();

(function setupModal() {
  const modal = document.getElementById("template-modal");
  const backdrop = document.getElementById("template-modal-backdrop");
  const titleEl = document.getElementById("template-modal-title");
  const contentEl = document.getElementById("template-modal-content");
  const closeBtn = document.getElementById("template-modal-close");
  const infoBtn = document.getElementById("template-info-btn");
  function open(opts = {}) {
    if (!modal || !backdrop) return;
    if (opts.title && titleEl) titleEl.textContent = opts.title;
    if (opts.html && contentEl) contentEl.innerHTML = opts.html;
    modal.classList.add("show");
    backdrop.classList.add("show");
  }
  function close() {
    modal && modal.classList.remove("show");
    backdrop && backdrop.classList.remove("show");
  }
  window.TemplateUI = window.TemplateUI || {};
  window.TemplateUI.openModal = open;
  window.TemplateUI.closeModal = close;
  closeBtn && closeBtn.addEventListener("click", close);
  backdrop && backdrop.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
  infoBtn && infoBtn.addEventListener("click", () => open());
})();

// ====== Tree Node Class ======
class TreeNode {
  constructor(value, left = null, right = null, type = "operator") {
    this.value = value;
    this.left = left;
    this.right = right;
    this.type = type; // 'operator', 'terminal', 'constant'
  }

  // Deep copy
  clone() {
    return new TreeNode(
      this.value,
      this.left ? this.left.clone() : null,
      this.right ? this.right.clone() : null,
      this.type
    );
  }

  // Count nodes in subtree
  size() {
    let count = 1;
    if (this.left) count += this.left.size();
    if (this.right) count += this.right.size();
    return count;
  }

  // Get depth of tree
  depth() {
    if (!this.left && !this.right) return 0;
    const leftDepth = this.left ? this.left.depth() : 0;
    const rightDepth = this.right ? this.right.depth() : 0;
    return 1 + Math.max(leftDepth, rightDepth);
  }

  // Convert to string representation
  toString() {
    if (this.type === "terminal" || this.type === "constant") {
      return this.value.toString();
    }
    
    const op = this.value;
    // Unary operators
    if (["sin", "cos", "exp", "log", "abs"].includes(op)) {
      const arg = this.left ? this.left.toString() : "";
      return `${op}(${arg})`;
    }
    // Binary operators
    const leftStr = this.left ? this.left.toString() : "";
    const rightStr = this.right ? this.right.toString() : "";
    return `(${leftStr} ${op} ${rightStr})`;
  }

  // Evaluate the tree for a given x value
  evaluate(x) {
    try {
      if (this.type === "terminal") {
        return x;
      }
      if (this.type === "constant") {
        return this.value;
      }

      const op = this.value;
      
      // Unary operators
      if (op === "sin") {
        return Math.sin(this.left.evaluate(x));
      }
      if (op === "cos") {
        return Math.cos(this.left.evaluate(x));
      }
      if (op === "exp") {
        const val = this.left.evaluate(x);
        // Limit exp to prevent overflow
        if (val > 50) return Math.exp(50);
        if (val < -50) return Math.exp(-50);
        return Math.exp(val);
      }
      if (op === "log") {
        const val = this.left.evaluate(x);
        if (val <= 0) return 0; // Handle invalid log
        return Math.log(Math.abs(val));
      }
      if (op === "abs") {
        return Math.abs(this.left.evaluate(x));
      }

      // Binary operators
      const leftVal = this.left.evaluate(x);
      const rightVal = this.right.evaluate(x);

      if (op === "+") return leftVal + rightVal;
      if (op === "-") return leftVal - rightVal;
      if (op === "*") {
        // Limit multiplication to prevent overflow
        const result = leftVal * rightVal;
        if (Math.abs(result) > 1e10) return Math.sign(result) * 1e10;
        return result;
      }
      if (op === "/") {
        // Protected division
        if (Math.abs(rightVal) < 0.0001) return 1;
        const result = leftVal / rightVal;
        if (!isFinite(result)) return 1;
        if (Math.abs(result) > 1e10) return Math.sign(result) * 1e10;
        return result;
      }

      return 0;
    } catch (e) {
      return 0; // Return 0 on any error
    }
  }
}

// ====== Genetic Programming Engine ======
class GeneticProgramming {
  constructor(config) {
    this.populationSize = config.populationSize || 50;
    this.maxDepth = config.maxDepth || 5;
    this.mutationRate = config.mutationRate || 0.1;
    this.crossoverRate = config.crossoverRate || 0.9;
    this.targetFunction = config.targetFunction;
    
    this.operators = ["+", "-", "*", "/"];
    this.unaryOperators = ["sin", "cos", "abs"]; // Reduced set for stability
    
    this.population = [];
    this.bestIndividual = null;
    this.bestFitness = Infinity;
    
    // Generate sample points
    this.samplePoints = [];
    this.targetValues = [];
    const numSamples = 200;
    for (let i = 0; i < numSamples; i++) {
      const x = -3 + (6 * i) / (numSamples - 1);
      this.samplePoints.push(x);
      this.targetValues.push(this.targetFunction(x));
    }
  }

  // Generate random tree
  generateTree(depth = 0, method = "grow") {
    const maxD = this.maxDepth;
    
    // Force terminal at max depth
    if (depth >= maxD) {
      return this.generateTerminal();
    }

    // For "grow" method, randomly choose terminal or operator
    // For "full" method, force operators until max depth
    const useOperator = method === "full" 
      ? depth < maxD - 1
      : Math.random() < 0.7 && depth < maxD - 1;

    if (useOperator) {
      return this.generateOperator(depth, method);
    } else {
      return this.generateTerminal();
    }
  }

  generateTerminal() {
    if (Math.random() < 0.6) {
      return new TreeNode("x", null, null, "terminal");
    } else {
      // Random constant between -5 and 5
      const constant = (Math.random() * 10 - 5).toFixed(2);
      return new TreeNode(parseFloat(constant), null, null, "constant");
    }
  }

  generateOperator(depth, method) {
    // Choose between binary and unary operators
    const useUnary = Math.random() < 0.3;
    
    if (useUnary) {
      const op = this.unaryOperators[Math.floor(Math.random() * this.unaryOperators.length)];
      const child = this.generateTree(depth + 1, method);
      return new TreeNode(op, child, null, "operator");
    } else {
      const op = this.operators[Math.floor(Math.random() * this.operators.length)];
      const left = this.generateTree(depth + 1, method);
      const right = this.generateTree(depth + 1, method);
      return new TreeNode(op, left, right, "operator");
    }
  }

  // Initialize population with ramped half-and-half
  initializePopulation() {
    this.population = [];
    const half = Math.floor(this.populationSize / 2);
    
    for (let i = 0; i < half; i++) {
      this.population.push(this.generateTree(0, "grow"));
    }
    for (let i = half; i < this.populationSize; i++) {
      this.population.push(this.generateTree(0, "full"));
    }
  }

  // Calculate fitness (mean squared error)
  calculateFitness(individual) {
    let totalError = 0;
    let validPoints = 0;

    for (let i = 0; i < this.samplePoints.length; i++) {
      const x = this.samplePoints[i];
      const predicted = individual.evaluate(x);
      const target = this.targetValues[i];

      if (isFinite(predicted) && isFinite(target)) {
        const error = Math.pow(predicted - target, 2);
        totalError += error;
        validPoints++;
      } else {
        totalError += 1e6; // Penalty for invalid values
        validPoints++;
      }
    }

    return validPoints > 0 ? totalError / validPoints : 1e10;
  }

  // Tournament selection
  tournamentSelection(tournamentSize = 3) {
    let best = null;
    let bestFitness = Infinity;

    for (let i = 0; i < tournamentSize; i++) {
      const idx = Math.floor(Math.random() * this.population.length);
      const individual = this.population[idx];
      const fitness = this.calculateFitness(individual);

      if (fitness < bestFitness) {
        best = individual;
        bestFitness = fitness;
      }
    }

    return best.clone();
  }

  // Subtree crossover
  crossover(parent1, parent2) {
    const child1 = parent1.clone();
    const child2 = parent2.clone();

    // Get random subtree from each parent
    const node1 = this.getRandomNode(child1);
    const node2 = this.getRandomNode(child2);

    if (node1 && node2) {
      // Swap subtrees
      const temp = node1.left;
      node1.left = node2.left;
      node2.left = temp;

      const temp2 = node1.right;
      node1.right = node2.right;
      node2.right = temp2;

      const temp3 = node1.value;
      node1.value = node2.value;
      node2.value = temp3;

      const temp4 = node1.type;
      node1.type = node2.type;
      node2.type = temp4;
    }

    return child1;
  }

  // Get random node in tree
  getRandomNode(tree) {
    const nodes = [];
    this.collectNodes(tree, nodes);
    if (nodes.length === 0) return tree;
    return nodes[Math.floor(Math.random() * nodes.length)];
  }

  collectNodes(node, list) {
    if (!node) return;
    list.push(node);
    this.collectNodes(node.left, list);
    this.collectNodes(node.right, list);
  }

  // Subtree mutation
  mutate(individual) {
    const mutated = individual.clone();
    const node = this.getRandomNode(mutated);
    
    if (node) {
      // Replace with new random subtree
      const newSubtree = this.generateTree(0, "grow");
      node.value = newSubtree.value;
      node.left = newSubtree.left;
      node.right = newSubtree.right;
      node.type = newSubtree.type;
    }

    return mutated;
  }

  // Run one generation
  evolveGeneration() {
    // Evaluate current population
    const fitnessScores = this.population.map((ind) => ({
      individual: ind,
      fitness: this.calculateFitness(ind),
    }));

    // Sort by fitness (lower is better)
    fitnessScores.sort((a, b) => a.fitness - b.fitness);

    // Track best
    if (fitnessScores[0].fitness < this.bestFitness) {
      this.bestFitness = fitnessScores[0].fitness;
      this.bestIndividual = fitnessScores[0].individual.clone();
    }

    // Generate new population
    const newPopulation = [];

    // Elitism: keep best individual
    newPopulation.push(fitnessScores[0].individual.clone());

    // Generate rest of population
    while (newPopulation.length < this.populationSize) {
      if (Math.random() < this.crossoverRate) {
        // Crossover
        const parent1 = this.tournamentSelection();
        const parent2 = this.tournamentSelection();
        let child = this.crossover(parent1, parent2);

        // Apply mutation
        if (Math.random() < this.mutationRate) {
          child = this.mutate(child);
        }

        newPopulation.push(child);
      } else {
        // Just select and possibly mutate
        let child = this.tournamentSelection();
        if (Math.random() < this.mutationRate) {
          child = this.mutate(child);
        }
        newPopulation.push(child);
      }
    }

    this.population = newPopulation;

    // Calculate average fitness
    const avgFitness =
      fitnessScores.reduce((sum, item) => sum + item.fitness, 0) /
      fitnessScores.length;

    return {
      bestFitness: this.bestFitness,
      avgFitness: avgFitness,
      bestIndividual: this.bestIndividual,
    };
  }
}

// ====== Main Application ======
class GPSymbolicRegressionApp {
  constructor() {
    this.gp = null;
    this.running = false;
    this.generation = 0;
    this.maxGenerations = 100;
    this.animationFrameId = null;

    // Get UI elements
    this.iterationDisplay = document.getElementById("iteration");
    this.metricDisplay = document.getElementById("metric");
    this.statusDisplay = document.getElementById("status");
    this.startButton = document.getElementById("startButton");
    this.pauseButton = document.getElementById("pauseButton");
    this.resetButton = document.getElementById("resetButton");

    // Target function selector
    this.targetFunctionSelect = document.getElementById("targetFunction");

    // Parameter controls
    this.populationSizeSlider = document.getElementById("populationSize");
    this.populationSizeValue = document.getElementById("populationSizeValue");
    this.generationsSlider = document.getElementById("generations");
    this.generationsValue = document.getElementById("generationsValue");
    this.mutationRateSlider = document.getElementById("mutationRate");
    this.mutationRateValue = document.getElementById("mutationRateValue");
    this.crossoverRateSlider = document.getElementById("crossoverRate");
    this.crossoverRateValue = document.getElementById("crossoverRateValue");
    this.maxDepthSlider = document.getElementById("maxDepth");
    this.maxDepthValue = document.getElementById("maxDepthValue");

    // Visualization elements
    this.treeContainer = document.getElementById("tree-container");
    this.treeCanvas = document.createElement("canvas");
    this.treeCanvas.style.width = "100%";
    this.treeCanvas.style.height = "100%";
    this.treeContainer.appendChild(this.treeCanvas);
    this.treeCtx = this.treeCanvas.getContext("2d");
    
    this.plotCanvas = document.getElementById("plot-canvas");
    this.plotCtx = this.plotCanvas.getContext("2d");
    
    this.fitnessCanvas = document.getElementById("fitnessChart");
    this.fitnessCtx = this.fitnessCanvas.getContext("2d");

    // Fitness history
    this.bestFitnessHistory = [];
    this.avgFitnessHistory = [];

    this.attachEvents();
    this.setupSliders();
    this.updateStatus("Ready");
    this.resizeCanvases();
    window.addEventListener("resize", () => this.resizeCanvases());
  }

  // Target functions
  getTargetFunction() {
    const selected = this.targetFunctionSelect.value;
    const functions = {
      sin: (x) => Math.sin(x),
      x2: (x) => x * x,
      x2_plus_x: (x) => x * x + x,
      abs: (x) => Math.abs(x),
      x3: (x) => x * x * x - x,
    };
    return functions[selected];
  }

  setupSliders() {
    this.populationSizeSlider.addEventListener("input", (e) => {
      this.populationSizeValue.textContent = e.target.value;
    });
    this.generationsSlider.addEventListener("input", (e) => {
      this.generationsValue.textContent = e.target.value;
    });
    this.mutationRateSlider.addEventListener("input", (e) => {
      this.mutationRateValue.textContent = parseFloat(e.target.value).toFixed(2);
    });
    this.crossoverRateSlider.addEventListener("input", (e) => {
      this.crossoverRateValue.textContent = parseFloat(e.target.value).toFixed(2);
    });
    this.maxDepthSlider.addEventListener("input", (e) => {
      this.maxDepthValue.textContent = e.target.value;
    });
  }

  attachEvents() {
    this.startButton?.addEventListener("click", () => this.start());
    this.pauseButton?.addEventListener("click", () => this.pause());
    this.resetButton?.addEventListener("click", () => this.reset());
  }

  start() {
    if (!this.gp || this.generation === 0) {
      // Initialize new GP run
      const config = {
        populationSize: parseInt(this.populationSizeSlider.value),
        maxDepth: parseInt(this.maxDepthSlider.value),
        mutationRate: parseFloat(this.mutationRateSlider.value),
        crossoverRate: parseFloat(this.crossoverRateSlider.value),
        targetFunction: this.getTargetFunction(),
      };

      this.gp = new GeneticProgramming(config);
      this.gp.initializePopulation();
      this.maxGenerations = parseInt(this.generationsSlider.value);
      this.generation = 0;
      this.bestFitnessHistory = [];
      this.avgFitnessHistory = [];
    }

    this.running = true;
    this.startButton.disabled = true;
    this.pauseButton.disabled = false;
    this.updateStatus("Running");
    this.runEvolution();
  }

  pause() {
    this.running = false;
    this.startButton.disabled = false;
    this.pauseButton.disabled = true;
    this.updateStatus("Paused");
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  reset() {
    this.running = false;
    this.gp = null;
    this.generation = 0;
    this.bestFitnessHistory = [];
    this.avgFitnessHistory = [];

    this.startButton.disabled = false;
    this.pauseButton.disabled = true;
    this.iterationDisplay.textContent = "0";
    this.metricDisplay.textContent = "N/A";
    this.updateStatus("Ready");

    // Clear visualizations
    this.clearTreeCanvas();
    this.clearPlotCanvas();
    this.clearFitnessCanvas();

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  runEvolution() {
    if (!this.running || this.generation >= this.maxGenerations) {
      if (this.generation >= this.maxGenerations) {
        this.updateStatus("Completed");
        this.startButton.disabled = false;
        this.pauseButton.disabled = true;
      }
      return;
    }

    // Run one generation
    const result = this.gp.evolveGeneration();
    this.generation++;

    // Update history
    this.bestFitnessHistory.push(result.bestFitness);
    this.avgFitnessHistory.push(result.avgFitness);

    // Update UI
    this.iterationDisplay.textContent = this.generation.toString();
    this.metricDisplay.textContent = result.bestFitness.toFixed(4);

    // Update visualizations
    this.drawTree(result.bestIndividual);
    this.drawFunctionComparison(result.bestIndividual);
    this.drawFitnessChart();

    // Continue evolution
    this.animationFrameId = requestAnimationFrame(() => this.runEvolution());
  }

  drawTree(tree) {
    if (!tree) return;

    this.clearTreeCanvas();
    
    const canvas = this.treeCanvas;
    const ctx = this.treeCtx;
    const width = canvas.width;
    const height = canvas.height;

    // Calculate tree layout
    const layout = this.calculateTreeLayout(tree, width, height);
    
    // Draw links first (so they appear behind nodes)
    ctx.strokeStyle = "#1f2a44";
    ctx.lineWidth = 2;
    layout.links.forEach(link => {
      ctx.beginPath();
      ctx.moveTo(link.x1, link.y1);
      ctx.lineTo(link.x2, link.y2);
      ctx.stroke();
    });

    // Draw nodes
    layout.nodes.forEach(node => {
      // Draw circle
      ctx.fillStyle = "#0f1730";
      ctx.strokeStyle = "#5cf2c7";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(node.x, node.y, 20, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      // Draw text
      ctx.fillStyle = "#e7edf6";
      ctx.font = "600 11px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const text = typeof node.value === "number" ? node.value.toFixed(1) : node.value;
      ctx.fillText(text, node.x, node.y);
    });
  }

  calculateTreeLayout(tree, width, height) {
    const nodes = [];
    const links = [];
    const padding = 40;
    
    // First pass: assign levels and count nodes per level
    const levelCounts = {};
    const levelIndices = {};
    
    const assignLevels = (node, level) => {
      if (!node) return;
      if (!levelCounts[level]) {
        levelCounts[level] = 0;
        levelIndices[level] = 0;
      }
      levelCounts[level]++;
      assignLevels(node.left, level + 1);
      assignLevels(node.right, level + 1);
    };
    
    assignLevels(tree, 0);
    
    const maxLevel = Math.max(...Object.keys(levelCounts).map(Number));
    const levelHeight = (height - 2 * padding) / (maxLevel + 1);
    
    // Second pass: assign positions
    const positionNode = (node, level, parent = null) => {
      if (!node) return null;
      
      const index = levelIndices[level]++;
      const totalAtLevel = levelCounts[level];
      const x = padding + ((width - 2 * padding) * (index + 0.5)) / totalAtLevel;
      const y = padding + level * levelHeight;
      
      const nodeData = { x, y, value: node.value };
      nodes.push(nodeData);
      
      if (parent) {
        links.push({ x1: parent.x, y1: parent.y, x2: x, y2: y });
      }
      
      positionNode(node.left, level + 1, nodeData);
      positionNode(node.right, level + 1, nodeData);
      
      return nodeData;
    };
    
    // Reset indices for positioning
    Object.keys(levelIndices).forEach(key => levelIndices[key] = 0);
    positionNode(tree, 0);
    
    return { nodes, links };
  }

  clearTreeCanvas() {
    const canvas = this.treeCanvas;
    const ctx = this.treeCtx;
    ctx.fillStyle = "#121a2b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  drawFunctionComparison(bestTree) {
    this.clearPlotCanvas();

    const canvas = this.plotCanvas;
    const ctx = this.plotCtx;
    const width = canvas.width;
    const height = canvas.height;

    const padding = 40;
    const plotWidth = width - 2 * padding;
    const plotHeight = height - 2 * padding;

    // Get data
    const xMin = -3;
    const xMax = 3;
    const numPoints = 200;
    const targetFunc = this.getTargetFunction();

    const xPoints = [];
    const targetPoints = [];
    const evolvedPoints = [];

    for (let i = 0; i < numPoints; i++) {
      const x = xMin + ((xMax - xMin) * i) / (numPoints - 1);
      xPoints.push(x);
      targetPoints.push(targetFunc(x));
      if (bestTree) {
        evolvedPoints.push(bestTree.evaluate(x));
      }
    }

    // Find y range
    let yMin = Math.min(...targetPoints);
    let yMax = Math.max(...targetPoints);
    if (evolvedPoints.length > 0) {
      const validEvolved = evolvedPoints.filter(y => isFinite(y));
      if (validEvolved.length > 0) {
        yMin = Math.min(yMin, ...validEvolved);
        yMax = Math.max(yMax, ...validEvolved);
      }
    }
    
    // Add margin
    const yRange = yMax - yMin;
    yMin -= yRange * 0.1;
    yMax += yRange * 0.1;

    // Helper functions
    const xScale = (x) => padding + ((x - xMin) / (xMax - xMin)) * plotWidth;
    const yScale = (y) => height - padding - ((y - yMin) / (yMax - yMin)) * plotHeight;

    // Draw axes
    ctx.strokeStyle = "#1f2a44";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.stroke();

    // Draw target function
    ctx.strokeStyle = "#5cf2c7";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < numPoints; i++) {
      const x = xScale(xPoints[i]);
      const y = yScale(targetPoints[i]);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Draw evolved function
    if (evolvedPoints.length > 0) {
      ctx.strokeStyle = "#57a6ff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < numPoints; i++) {
        const y = evolvedPoints[i];
        if (isFinite(y) && y >= yMin && y <= yMax) {
          const x = xScale(xPoints[i]);
          const yPos = yScale(y);
          if (!started) {
            ctx.moveTo(x, yPos);
            started = true;
          } else {
            ctx.lineTo(x, yPos);
          }
        } else {
          started = false;
        }
      }
      ctx.stroke();
    }

    // Draw labels
    ctx.fillStyle = "#a7b1c2";
    ctx.font = "12px system-ui";
    ctx.fillText("x", width - padding + 5, height - padding + 5);
    ctx.fillText("y", padding - 5, padding - 5);

    // Legend
    ctx.fillStyle = "#5cf2c7";
    ctx.fillText("Target", width - padding - 80, padding + 10);
    ctx.fillStyle = "#57a6ff";
    ctx.fillText("Evolved", width - padding - 80, padding + 25);
  }

  resizeCanvases() {
    // Resize tree canvas
    const treeContainer = this.treeContainer;
    this.treeCanvas.width = treeContainer.clientWidth;
    this.treeCanvas.height = treeContainer.clientHeight;
    
    // Resize plot canvas
    const plotContainer = this.plotCanvas.parentElement;
    this.plotCanvas.width = plotContainer.clientWidth;
    this.plotCanvas.height = plotContainer.clientHeight - 40;
    
    // Resize fitness canvas
    const fitnessContainer = this.fitnessCanvas.parentElement;
    this.fitnessCanvas.width = fitnessContainer.clientWidth;
    this.fitnessCanvas.height = fitnessContainer.clientHeight;
    
    // Redraw if we have data
    if (this.gp && this.gp.bestIndividual) {
      this.drawTree(this.gp.bestIndividual);
      this.drawFunctionComparison(this.gp.bestIndividual);
      this.drawFitnessChart();
    }
  }

  clearPlotCanvas() {
    const canvas = this.plotCanvas;
    this.plotCtx.fillStyle = "#0b1020";
    this.plotCtx.fillRect(0, 0, canvas.width, canvas.height);
  }

  updateStatus(msg) {
    if (this.statusDisplay) this.statusDisplay.textContent = msg;
  }

  drawFitnessChart() {
    const canvas = this.fitnessCanvas;
    const ctx = this.fitnessCtx;
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = "#121a2b";
    ctx.fillRect(0, 0, width, height);

    if (this.bestFitnessHistory.length === 0) return;

    const padding = 40;
    const plotWidth = width - 2 * padding;
    const plotHeight = height - 2 * padding;

    // Find data range (use log scale for fitness)
    const bestMin = Math.min(...this.bestFitnessHistory.filter(v => v > 0));
    const bestMax = Math.max(...this.bestFitnessHistory);
    const avgMin = Math.min(...this.avgFitnessHistory.filter(v => v > 0));
    const avgMax = Math.max(...this.avgFitnessHistory);
    
    let yMin = Math.min(bestMin, avgMin);
    let yMax = Math.max(bestMax, avgMax);
    
    // Use log scale
    yMin = Math.log10(Math.max(yMin, 0.0001));
    yMax = Math.log10(Math.max(yMax, 0.0001));
    const yRange = yMax - yMin;
    
    const xScale = (i) => padding + (i / (this.generation - 1)) * plotWidth;
    const yScale = (val) => {
      const logVal = Math.log10(Math.max(val, 0.0001));
      return height - padding - ((logVal - yMin) / yRange) * plotHeight;
    };

    // Draw axes
    ctx.strokeStyle = "#1f2a44";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.stroke();

    // Draw grid
    ctx.strokeStyle = "rgba(231,237,246,0.06)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padding + (plotHeight * i) / 5;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    // Draw average fitness line
    ctx.strokeStyle = "#57a6ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < this.avgFitnessHistory.length; i++) {
      const x = xScale(i);
      const y = yScale(this.avgFitnessHistory[i]);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Draw best fitness line
    ctx.strokeStyle = "#5cf2c7";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < this.bestFitnessHistory.length; i++) {
      const x = xScale(i);
      const y = yScale(this.bestFitnessHistory[i]);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Draw labels
    ctx.fillStyle = "#a7b1c2";
    ctx.font = "11px system-ui";
    ctx.textAlign = "left";
    ctx.fillText("Generation", width - padding - 50, height - padding + 20);
    
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillText("Fitness (log scale)", 0, 0);
    ctx.restore();

    // Draw legend
    ctx.fillStyle = "#5cf2c7";
    ctx.fillText("Best", width - padding - 120, 20);
    ctx.fillStyle = "#57a6ff";
    ctx.fillText("Avg", width - padding - 60, 20);
  }

  clearFitnessCanvas() {
    const canvas = this.fitnessCanvas;
    const ctx = this.fitnessCtx;
    ctx.fillStyle = "#121a2b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

// Initialize app when DOM is ready
window.addEventListener("DOMContentLoaded", () => {
  new GPSymbolicRegressionApp();
});
