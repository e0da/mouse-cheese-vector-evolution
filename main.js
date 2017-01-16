var MAX_POPULATION = 1000
var MAX_STEPS      = 200
var WIDTH          = 800 * 2
var HEIGHT         = 450 * 2
var ORIGIN         = {x: WIDTH / 2, y: HEIGHT - 64}
var GOAL           = {x: WIDTH -(32 / 2 + 32 * 3 ), y: 32 / 2}
var HAZARD         = {x: WIDTH -(32 / 2 + 32 * 1 ), y: 32 / 2}
var ZERO           = {x: 0, y: 0}
var MAGNITUDE      = 4000
var MUTATION_RATE  = 0.01
var MAX_GOALS      = 10
var MAX_HAZARDS    = 10

var game = new Phaser.Game(WIDTH, HEIGHT, Phaser.AUTO, 'game', {
  preload: preload, create: create, update: update})

var bg
var goals
var hazards
var population
var step
var generation
var summary
var toolbox

function preload() {
  game.load.image('grass', 'assets/grass.png')
  game.load.image('cheese', 'assets/cheese.gif')
  game.load.image('toolbox', 'assets/toolbox.png')
  game.load.spritesheet('characters', 'assets/lpccatratdog.png', 32, 32)
  game.load.spritesheet('spider', 'assets/Fother-spider.png', 35, 35)
}

function create() {
  generation = 0

  game.physics.startSystem(Phaser.Physics.ARCADE)
  game.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL
  game.stage.disableVisibilityChange = true

  bg = game.add.tileSprite(0, 0, game.width, game.height, 'grass')
  bg.tileScale.x = bg.tileScale.y = 1

  toolbox = game.add.sprite(WIDTH - 32 * 2 * 2, 0, 'toolbox')
  toolbox.width = 32 * 2 * 2
  toolbox.height = 64
  game.physics.arcade.enable(toolbox)
  toolbox.body.immovable = true

  population = game.add.physicsGroup()

  goals = game.add.physicsGroup()
  for (let i = 0; i < MAX_GOALS; i++) {
    let cheese = goals.create(GOAL.x, GOAL.y, 'cheese')
    cheese.body.immovable = true
    cheese.inputEnabled = true
    cheese.input.enableDrag()
  }

  hazards = game.add.physicsGroup()
  for (let i = 0; i < MAX_HAZARDS; i++) {
    let spider = hazards.create(HAZARD.x, HAZARD.y, 'spider')
    spider.body.immovable = true
    spider.inputEnabled = true
    spider.input.enableDrag()
    spider.animations.add('idle', [0, 6])
    spider.animations.play('idle', 2, true)
  }

  summary = game.add.text(10, 10, summaryText(), {
    font: '12pt Arial',
    fill: 'white',
    fontWeight: 'bold',
    stroke: 'black'})
  summary.setShadow(0, 0, 'black', 1)

  setUpGeneration()
}

function setUpGeneration() {
  step = 0
  generation++

  // Kill the weakest 2/3
  let doomed = population.children.sort(function (left, right) {
    return left.fitness - right.fitness
  }).splice(0, Math.floor(population.length * 0.5))

  for (let i = 0; i < doomed.length; i++) {
    die(doomed[i])
  }

  // Breed new generation
  while (population.length < MAX_POPULATION) {
    let critter = population.create(ORIGIN.x, ORIGIN.y, 'characters')
    critter.anchor.x = critter.anchor.y = 0.5
    critter.animations.add('walk', [0, 1, 0, 2])
    critter.animations.play('walk', 10, true)
    critter.body.collideWorldBounds = true
    critter.genome = randomGenome()
    critter.generation = generation
    critter.fitness = 0
    critter.won = false
    critter.lost = false
  }

  summary.setText(summaryText())

  // Reset survivors
  population.setAll('fitness', 0)
  population.setAll('won', false)
  population.setAll('lost', false)
  population.setAll('body.position.x', ORIGIN.x)
  population.setAll('body.position.y', ORIGIN.y)
  population.setAll('body.velocity.x', ZERO.x)
  population.setAll('body.velocity.y', ZERO.y)
  population.setAll('body.acceleration.x', ZERO.x)
  population.setAll('body.acceleration.y', ZERO.y)
}

function update() {

  game.physics.arcade.collide(population, toolbox)
  game.physics.arcade.overlap(population, goals, win)
  game.physics.arcade.overlap(population, hazards, lose)

  for (let i = 0; i < population.length; i++) {
    let critter = population.children[i]

    if (critter.won) {
      critter.fitness += (1/MAX_STEPS)
      critter.won = false
    }


    critter.body.acceleration = critter.genome[step]

    // Point the critter along its velocity vector
    critter.rotation = Math.PI / 2 + critter.position.angle(critter.previousPosition)

    // Kill them if they touch a hazard.
    if (critter.lost) {
      critter.destroy()
      // critter.fitness -= (1/MAX_STEPS) * 10
      // critter.lost = false
    }
  }
  if (++step >= MAX_STEPS) {
    setUpGeneration()
  }
}

function randomGenome() {
  let left  = randomlySelectedGenome() || randomNewGenome()
  // let right = randomlySelectedGenome() || randomNewGenome()
  let genome = []
  // let split = Math.floor(Math.random() * left.length)
  for (let i = 0; i < left.length; i++) {
    // genome[i] = i < split ? left[i] : right[i]
    genome[i] = left[i]
    if (Math.random() > (1 - MUTATION_RATE)) {
      genome[i] = randomVector()
    } else {
      genome[i] = left[i]
    }
  }
  return genome
}

function randomNewGenome() {
  let genome = []
  for (let i = 0; i < MAX_STEPS; i++) {
    genome[i] = randomVector()
  }
  return genome
}

function win(critter, goal) {
  critter.won = true
}

function lose(critter, hazard) {
  critter.lost = true
}

function randomlySelectedGenome() {
  if (generation == 1) return randomNewGenome()
  let critter = population.children[game.rnd.integerInRange(0, population.length)]
  return critter ? critter.genome : null
}

function randomVector() {
  let vector = new Phaser.Point(Math.random() * 2 - 1, Math.random() * 2 - 1)
  vector.setMagnitude(MAGNITUDE)
  return vector
}

function allFitnesses() {
  return population.children.map(function (c) { return c.fitness })
}

function avgFitness() {
  let fitnesses = allFitnesses()
  if (fitnesses.length == 0) {
    return 0
  } else {
    return fitnesses.reduce(function (a, b) { return a + b}) / population.length
  }
}

function maxFitness() {
  return Math.max.apply(null, allFitnesses())
}

function age(critter) {
  return generation - critter.generation
}

function maxAge() {
  return Math.max.apply(null, allAges())
}

function allAges() {
  return population.children.map(function (c) { return age(c) })
}

function avgAge() {
  let ages = allAges()
  return ages.reduce(function (acc, age) { return acc + age }, 0) / ages.length
}

function summaryText() {
  return [
    'Generation: ',
    generation,
    '\n',
    'Fitness max/avg: ',
    prettyFloat(maxFitness()),
    '% / ',
    prettyFloat(avgFitness()),
    '%',
    '\n',
    'Age max/avg: ',
    maxAge(),
    ' / ',
    avgAge(),
  ].join('')
}

function prettyFloat(num) {
  return Math.floor(num * 10000) / 100
}

function die(critter) {
  critter.destroy()
}
