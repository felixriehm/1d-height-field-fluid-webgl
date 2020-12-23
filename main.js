"use strict";

// simulation parameter
var canvasHeight = 150;
var canvasWidth = 600;
var waveColumnsCount = 40;
var waveColumnsWidth = canvasWidth / waveColumnsCount;
var waveColumnsInitalHeight = canvasHeight / 3;
var waveColumnsGap = 2;
var waveColumnsColor = [0.14, 0.35, 0.47, 1];
var waveColumnsHoveredColor = [1, 0, 0, 1];
var autoPlayInterval = 100;
var interactionAddWater = 125;
var interactionApplyForce = -14;
var u = Array(waveColumnsCount).fill(waveColumnsInitalHeight); // height field array
var c = 4; // wave velocity, condition: c < h/dt
var h = waveColumnsWidth; // width of a wave cell
var s = 0.7; // scaling factor for damping
var v = Array(waveColumnsCount).fill(0); // velocity of wave cell
var dt = 2; // delta time, condition: dt < h/c

// Application variables
var matrixLocation;
var colorLocation;
var gl; // GL context
var stopAutoPlay = true;
var debugView = false;
var createWaveByAddingWater = true;
var boundaryConditionReflacting = true;
var hoveredColumn;
var selectedColumn;
var then = 0;
var intervalDeltaTime = 0;

// UI elements
var htmlToggleAutoPlayButton,
htmlCycleButton,
htmlDebugUArrayHtmlEl,
htmlDebugVArrayHtmlEl,
htmlDebugViewContainer,
htmlInitialWaterHeight,
htmlWaveColumnsCount,
htmlWaveVelocity,
htmlWaveColumsWidth,
htmlDampingScaling,
htmlDeltaTime,
htmlChangeHeight,
htmlChangeForce,
htmlAutoPlayInterval,
htmlCanvasHeight,
htmlCanvasWidth;

function main() {
  // Get A WebGL context
  /** @type {HTMLCanvasElement} */
  var canvas = document.querySelector("#canvas");
  canvas.height = canvasHeight;
  canvas.width = canvasWidth;
  gl = canvas.getContext("webgl");
  if (!gl) {
    return;
  }

  // init UI
  htmlDebugViewContainer = document.querySelector("#debug-view-container");
  htmlDebugVArrayHtmlEl = document.querySelector("#debug-v-array");
  htmlDebugUArrayHtmlEl = document.querySelector("#debug-u-array");
  htmlToggleAutoPlayButton = document.querySelector("#toggleAutoPlayButton");
  htmlCycleButton = document.querySelector("#cycleButton");
  htmlInitialWaterHeight = document.querySelector("#initialWaterHeight");
  htmlWaveColumnsCount = document.querySelector("#waveColumnsCount");
  htmlWaveVelocity = document.querySelector("#waveVelocity");
  htmlWaveColumsWidth = document.querySelector("#waveColumsWidth");
  htmlDampingScaling = document.querySelector("#dampingScaling");
  htmlDeltaTime = document.querySelector("#deltaTime");
  htmlChangeHeight = document.querySelector("#changeHeight");
  htmlChangeForce = document.querySelector("#changeForce");
  htmlAutoPlayInterval = document.querySelector("#autoPlayInterval");
  htmlCanvasHeight = document.querySelector("#canvasHeight");
  htmlCanvasWidth = document.querySelector("#canvasWidth");
  htmlAutoPlayInterval.value = autoPlayInterval;
  htmlInitialWaterHeight.value = waveColumnsInitalHeight;
  htmlWaveColumnsCount.value = waveColumnsCount;
  htmlWaveVelocity.value = c;
  htmlWaveColumsWidth.value = h;
  htmlDampingScaling.value = s;
  htmlDeltaTime.value = dt;
  htmlChangeHeight.value = interactionAddWater;
  htmlChangeForce.value = interactionApplyForce;
  htmlCanvasHeight.innerText = canvasHeight;
  htmlCanvasWidth.innerText = canvasWidth;
  updatedebugView();

  gl.canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    var mouseX = e.clientX - rect.left;

    hoveredColumn = Number.parseInt(mouseX / waveColumnsWidth);
  });

  gl.canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    var mouseX = e.clientX - rect.left;

    selectedColumn = Number.parseInt(mouseX / waveColumnsWidth);
    createWave(selectedColumn);
  });

  // setup GLSL program
  var program = webglUtils.createProgramFromScripts(gl, ["vertex-shader-2d", "fragment-shader-2d"]);

  // look up where the vertex data needs to go.
  var positionLocation = gl.getAttribLocation(program, "a_position");
  matrixLocation = gl.getUniformLocation(program, "u_matrix");

  // lookup uniforms
  colorLocation = gl.getUniformLocation(program, "u_color");

  // Create a buffer to put positions in
  var positionBuffer = gl.createBuffer();
  // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  // Put geometry data into buffer
  setGeometry(gl);

  drawScene();

  // Draw the scene.
  function drawScene() {
    webglUtils.resizeCanvasToDisplaySize(gl.canvas);

    // Tell WebGL how to convert from clip space to pixels
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    // Clear the canvas.
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Tell it to use our program (pair of shaders)
    gl.useProgram(program);

    // Turn on the attribute
    gl.enableVertexAttribArray(positionLocation);

    // Bind the position buffer.
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    // Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
    var size = 2;          // 2 components per iteration
    var type = gl.FLOAT;   // the data is 32bit floats
    var normalize = false; // don't normalize the data
    var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
    var offset = 0;        // start at the beginning of the buffer
    gl.vertexAttribPointer(
        positionLocation, size, type, normalize, stride, offset);

    requestAnimationFrame(drawColumns);
  }
}

function drawColumns(now) {
  if(!stopAutoPlay) {
    intervalDeltaTime = intervalDeltaTime + (now - then);

    if(intervalDeltaTime >= autoPlayInterval) {
      intervalDeltaTime = 0;
      stepWave();
      updatedebugView();
    }

    then = now;
  }


  var primitiveType = gl.TRIANGLES;
  var offset = 0;
  var count = 6;
  var xTranslation = 0

  gl.clear(gl.COLOR_BUFFER_BIT);
  for (let index = 0; index < waveColumnsCount; index++) {
    var matrix = m3.projection(canvasWidth, canvasHeight);
    matrix = m3.translate(matrix, xTranslation + waveColumnsGap / 2, canvasHeight - u[index]);
    matrix = m3.scale(matrix, waveColumnsWidth - waveColumnsGap, u[index]);
    xTranslation += waveColumnsWidth;

    gl.uniformMatrix3fv(matrixLocation, false, matrix);

    if(index === hoveredColumn){
      gl.uniform4fv(colorLocation, waveColumnsHoveredColor);
    } else {
      gl.uniform4fv(colorLocation, waveColumnsColor);
    }

    gl.drawArrays(primitiveType, offset, count);
  }

  requestAnimationFrame(drawColumns);
}

function stepWave(){
  var uNew = Array(waveColumnsCount);
  for (let i = 0; i < u.length; i++) {

    // boundary
    var u1, u2;
    if(i === 0) {
      if(boundaryConditionReflacting) {
        u1 = u[i];
      } else {
        u1 = u[u.length-1];
      }
    } else {
      u1 = u[i-1];
    }
    
    if(i === u.length - 1) {
      if(boundaryConditionReflacting) {
        u2 = u[i];
      } else {
        u2 = u[0];
      }
    } else {
      u2 = u[i+1];
    }

    // calculate new height
    var f = Math.pow(c,2) * (u1 + u2 - 2*u[i]) / Math.pow(h,2)
    v[i] = s * (v[i] + f * dt);
    uNew[i] = u[i] + v[i] * dt;
  }

  u = uNew;
}

function onClickCycle() {
  cycleWave();
}

function cycleWave() {
  if(stopAutoPlay) {
    stepWave();
    drawColumns();
    updatedebugView();
  }
  
}

function createWave(column) {
  if(createWaveByAddingWater){
    u[column] = interactionAddWater;
  } else {
    v[column] = interactionApplyForce;
  }
  
  if(stopAutoPlay){
    stopAutoPlay = false;
    startAutoPlay();
  }
}

function onClickToogleAutoPlay() {
  stopAutoPlay = !stopAutoPlay;
  if(!stopAutoPlay){
    startAutoPlay();
  }else {
    toggleAutoPlayButton.innerText = "Start";
    htmlCycleButton.disabled = false;
  }
}

function startAutoPlay(){
    htmlToggleAutoPlayButton.innerText = "Stop";
    htmlCycleButton.disabled = true;
    then = 0;
    intervalDeltaTime = 0;
}

// Fill the buffer with the values that define a column.
function setGeometry(gl) {
  gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
          0, 1,
          1, 0,
          0, 0,
          0, 1,
          1, 0,
          1, 1,
      ]),
      gl.STATIC_DRAW);
}

function onDebugViewSwitch (radio) {
  debugView = !debugView;
  htmlDebugViewContainer.hidden = !debugView;
  updatedebugView();
}

function updatedebugView(){
  if(debugView){
    var vString = "";
    v.forEach((number,index) => {vString = vString + "[" + index + "] " + Number(number).toFixed(2) + ", "})
    htmlDebugVArrayHtmlEl.innerText = vString;
    var uString = "";
    u.forEach((number,index) => {uString = uString + "[" + index + "] " + Number(number).toFixed(2) + ", "})
    htmlDebugUArrayHtmlEl.innerText = uString;
  }
}

function onClickApply(){

  var newAutoPlayInterval = Number.parseInt(htmlAutoPlayInterval.value);
  if(newAutoPlayInterval && newAutoPlayInterval >= 20 && newAutoPlayInterval <= 10000) {
    autoPlayInterval = newAutoPlayInterval;
    htmlAutoPlayInterval.value = newAutoPlayInterval;
  } else {
    htmlAutoPlayInterval.value = autoPlayInterval;
  }

  var newWaveColumnsInitalHeight = Number.parseInt(htmlInitialWaterHeight.value);
  if(newWaveColumnsInitalHeight && newWaveColumnsInitalHeight >= 10) {
    waveColumnsInitalHeight = newWaveColumnsInitalHeight;
    htmlInitialWaterHeight.value = newWaveColumnsInitalHeight;
  } else {
    htmlInitialWaterHeight.value = waveColumnsInitalHeight;
  }

  var newWaveColumnsCount = Number.parseInt(htmlWaveColumnsCount.value);
  if(newWaveColumnsCount && newWaveColumnsCount >= 10 && newWaveColumnsCount <= 100) {
    waveColumnsCount = newWaveColumnsCount;
    htmlWaveColumnsCount.value = newWaveColumnsCount;
    waveColumnsWidth = canvasWidth / waveColumnsCount;
    h = waveColumnsWidth;
    htmlWaveColumsWidth.value = h;
  } else {
    htmlWaveColumnsCount.value = waveColumnsCount;
    htmlWaveColumsWidth.value = h;
  }

  var newC = Number.parseFloat(htmlWaveVelocity.value);
  var newDt = Number.parseFloat(htmlDeltaTime.value);
  if(newC && newC >= 0.01 && newC <= 1000 && newDt && newDt >= 0.01 && newDt <= 1000 && newC < h / newDt && newDt < h/newC) {
      c = newC;
      dt = newDt;
      htmlWaveVelocity.value = newC;
      htmlDeltaTime.value = newDt;
  } else {
    htmlWaveVelocity.value = c;
    htmlDeltaTime.value = dt;
  }

  var newS = Number.parseFloat(htmlDampingScaling.value);
  if(newS && newS >= 0.01 && newS < 1) {
    s = newS;
    htmlDampingScaling.value = newS;
  } else {
    htmlDampingScaling.value = s;
  }

  var newInteractionAddWater = Number.parseInt(htmlChangeHeight.value);
  if(newInteractionAddWater && newInteractionAddWater >= 1 && newInteractionAddWater <= 150) {
    interactionAddWater = newInteractionAddWater;
    htmlChangeHeight.value = newInteractionAddWater;
  } else {
    htmlChangeHeight.value = interactionAddWater;
  }

  var newInteractionApplyForce = Number.parseInt(htmlChangeForce.value);
  if(newInteractionApplyForce && newInteractionApplyForce >= -100 && newInteractionApplyForce <= 100) {
    interactionApplyForce = newInteractionApplyForce;
    htmlChangeForce.value = newInteractionApplyForce;
  } else {
    htmlChangeForce.value = interactionApplyForce;
  }

  createWaveByAddingWater = document.querySelector("#changeHeightRadio").checked;
  boundaryConditionReflacting = document.querySelector("#boundaryReflacting").checked;

  u = Array(waveColumnsCount).fill(waveColumnsInitalHeight);
  v = Array(waveColumnsCount).fill(0);

  if(!stopAutoPlay){
    stopAutoPlay = true;
    toggleAutoPlayButton.innerText = "Start AutoPlay";
    htmlCycleButton.disabled = false;
  }

  drawColumns();
  updatedebugView();
}

main();