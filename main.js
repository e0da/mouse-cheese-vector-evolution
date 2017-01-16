var MAX_POPULATION = 100
var MAX_STEPS      = 200
var WIDTH          = 800
var HEIGHT         = 600
var ORIGIN         = {x: WIDTH / 2, y: HEIGHT - 64}
var GOAL           = {x: WIDTH / 2 - 2 * 32, y: 32}
var HAZARD         = {x: WIDTH / 2 + 2 * 32, y: 32}
var ZERO           = {x: 0, y: 0}
var MAGNITUDE      = 2000
var MUTATION_RATE  = 0.005

var game = new Phaser.Game(WIDTH, HEIGHT, Phaser.AUTO, 'game', {
  preload: preload, create: create, update: update})

var bg
var goals
var hazards
var population
var step
var generation
var summary

function preload() {
  game.load.image('grass', 'assets/grass.png')
  game.load.image('cheese', 'assets/cheese.gif')
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

  population = game.add.physicsGroup()

  goals = game.add.physicsGroup()
  let cheese = goals.create(GOAL.x, GOAL.y, 'cheese')
  cheese.body.immovable = true
  cheese.inputEnabled = true
  cheese.input.enableDrag()

  hazards = game.add.physicsGroup()
  let spider = goals.create(HAZARD.x, HAZARD.y, 'spider')
  spider.body.immovable = true
  spider.inputEnabled = true
  spider.input.enableDrag()
  spider.animations.add('idle', [0, 6])
  spider.animations.play('idle', 2, true)

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
  summary.setText(summaryText())

  // Kill weakest half
  let doomed = population.children.sort(function (left, right) {
    return left.fitness - right.fitness
  }).splice(0, Math.ceil(population.length / 2))

  for (let i = 0; i < doomed.length; i++) {
    doomed[i].destroy()
  }

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

  let critterAge = function () {
    return generation - this.generation
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
    critter.age = critterAge
    critter.fitness = 0
    critter.won = false
    critter.lost = false
  }
}

function update() {

  game.physics.arcade.collide(population, goals, win)
  game.physics.arcade.collide(population, hazards, win)

  for (let i = 0; i < population.length; i++) {
    let critter = population.children[i]

    if (critter.won) {
      critter.fitness += (1/MAX_STEPS)
      critter.won = false
    }

    if (critter.lost) {
      critter.fitness -= (1/MAX_STEPS) * 2
      critter.lost = false
    }

    critter.body.acceleration = critter.genome[step]

    // Point the critter along its velocity vector
    critter.rotation = Math.PI / 2 + critter.position.angle(critter.previousPosition)
  }
  if (++step >= MAX_STEPS) {
    setUpGeneration()
  }
}

function randomGenome() {
  let left  = randomlySelectedGenome() || randomNewGenome()
  let right = randomlySelectedGenome() || randomNewGenome()
  let genome = []
  for (let i = 0; i < left.length; i++) {
    genome[i] = i % 2 == 0 ? left[i] : right[i]
    if (Math.random() > (1 - MUTATION_RATE)) {
      genome[i] = randomVector()
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

function lose(critter, goal) {
  critter.lost = true
}

function randomlySelectedGenome() {
  let critter = population[game.rnd.integerInRange(0, population.length)]
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

function averageFitness() {
  let fitnesses = allFitnesses()
  if (fitnesses.length == 0) {
    return 0
  } else {
    return fitnesses.reduce(function (a, b) { return a + b}) / population.length
  }
}

function averageAge() {
  if (population.length == 0) return 0
  return population.children.reduce(function (acc, critter) {
    return acc + critter.age()
  }, 0) / population.length
}

function summaryText() {
  return [
    'Generation: ',
    generation,
    '\n',
    'Avg Fitness: ',
    Math.floor(averageFitness() * 10000) / 100,
    '%',
    '\n',
    'Avg Age: ',
    averageAge()
  ].join('')
}
