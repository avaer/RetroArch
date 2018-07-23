#!/usr/bin/env node

const fs = require('fs');

const replacements = [
  [/((?:^|\n)var Module = .+?\n)/gm, `
    $1
    // hack 0
    const frameData = typeof window.VRFrameData !== 'undefined' ? new window.VRFrameData() : null;
  `],
  [/(function _glUseProgram\s*\([\s\S]+?\))[\s\S]+?(})/gm, `
    let hackedProgram = null;
    function _glUseProgram(program) {
      // hack 1
      program = program ? GL.programs[program] : null;
      GLctx.useProgram(program);

      if (program && program.hacked) {
        if (!program.vrLocation) {
          program.vrLocation = GLctx.getUniformLocation(program, 'uVr');
        }
        if (!program.modelViewLocation) {
          program.modelViewLocation = GLctx.getUniformLocation(program, 'uModelViewMatrix');
        }
        if (!program.projectionLocation) {
          program.projectionLocation = GLctx.getUniformLocation(program, 'uProjectionMatrix');
        }
        hackedProgram = program;
      } else {
        hackedProgram = null;
      }
    }
  `],
  /* [/(function _glDisable\s*\([\s\S]+?\))[\s\S]+?(})/gm, `
    function _glDisable(flag) {
      if (flag !== GLctx.DEPTH_TEST) {
        GLctx['disable'](flag);
      }
    }
  `], */
  [/(function _glShaderSource[\s\S]+?\))[\s\S]+?(})/gm, `
    function _glShaderSource(shader, count, string, length) {
      // hack 2
      const source = GL.getSource(shader, count, string, length);
      const shaderObj = GL.shaders[shader];
      if (Module.vr && shaderObj.type === GLctx.VERTEX_SHADER && /uniform int uVr;/.test(source)) {
        shaderObj.hacked = true;
      }
      GLctx.shaderSource(shaderObj, source);
    }
  `],
  [/(function _glAttachShader\s*\([\s\S]+?\))[\s\S]+?(})/gm, `
    function _glAttachShader(program, shader) {
      // hack 3
      const programObj = GL.programs[program];
      const shaderObj = GL.shaders[shader];
      programObj.hacked = programObj.hacked || shaderObj.hacked;
      GLctx.attachShader(programObj, shaderObj)
    }
  `],
  [/(function _glDrawArrays\s*\([\s\S]+?\))[\s\S]+?(})/gm, `
    /* const localFloat32Array = new Float32Array(16);
    const localMatrix = new THREE.Matrix4();
    const scale = 0.001;
    const transformMatrix = new THREE.Matrix4()
      .makeScale(scale, -scale, 1)
      .premultiply(new THREE.Matrix4().makeTranslation(0, 1, 0)); */

    function _glDrawArrays(mode, first, count) {
      // hack 4
      /* if (Module.display && !hackedProgram) {
        return;
      } */

      // left
      // GL.preDrawHandleClientVertexAttribBindings(first + count);

      const {leftEyeParameters} = Module;
      if (leftEyeParameters) {
        GLctx.viewport(0, 0, leftEyeParameters.renderWidth, leftEyeParameters.renderHeight);

        GLctx.disable(GLctx.SCISSOR_TEST);
        if (hackedProgram) {
          /* localMatrix
            .fromArray(frameData.leftViewMatrix)
            // .getInverse(localMatrix)
            .multiply(transformMatrix)
            // .getInverse(localMatrix)
            .toArray(localFloat32Array) */

          GLctx.uniform1i(hackedProgram.vrLocation, 1);
          GLctx.uniformMatrix4fv(hackedProgram.modelViewLocation, false, frameData.leftViewMatrix);
          GLctx.uniformMatrix4fv(hackedProgram.projectionLocation, false, frameData.leftProjectionMatrix);
        }
      }
      GLctx.drawArrays(mode, first, count);
      // GL.postDrawHandleClientVertexAttribBindings()

      // right
      const {rightEyeParameters} = Module;
      if (rightEyeParameters && rightEyeParameters.renderWidth > 0) {
        // GL.preDrawHandleClientVertexAttribBindings(first + count);
        if (leftEyeParameters && rightEyeParameters) {
          GLctx.viewport(leftEyeParameters.renderWidth, 0, rightEyeParameters.renderWidth, rightEyeParameters.renderHeight);

          GLctx.disable(GLctx.SCISSOR_TEST);
          if (hackedProgram) {
            /* localMatrix
              .fromArray(frameData.rightViewMatrix)
              // .getInverse(localMatrix)
              .multiply(transformMatrix)
              // .getInverse(localMatrix)
              .toArray(localFloat32Array); */

            GLctx.uniformMatrix4fv(hackedProgram.modelViewLocation, false, frameData.rightViewMatrix);
            GLctx.uniformMatrix4fv(hackedProgram.projectionLocation, false, frameData.rightProjectionMatrix);
          }
        }
        GLctx.drawArrays(mode, first, count);
        // GL.postDrawHandleClientVertexAttribBindings();
      }
    }
  `],
  [/(function requestAnimationFrame\s*\([\s\S]+?\))[\s\S]+?(},)/gm, `
     function requestAnimationFrame(func) {
        if (Module.display) {
          Module.display.requestAnimationFrame(function() {
            Module.preRender();

            Module.display.getFrameData(frameData);

            func.apply(this, arguments);

            Module.postRender();

            // display.submitFrame();
          });
        } else if (typeof window === "undefined") {
            Browser.fakeRequestAnimationFrame(function() {
              Module.preRender();

              func.apply(this, arguments);

              Module.postRender();
            });
        } else {
            if (!window.requestAnimationFrame) {
                window.requestAnimationFrame = window["requestAnimationFrame"] || window["mozRequestAnimationFrame"] || window["webkitRequestAnimationFrame"] || window["msRequestAnimationFrame"] || window["oRequestAnimationFrame"] || Browser.fakeRequestAnimationFrame
            }
            window.requestAnimationFrame(function() {
              Module.preRender();

              func.apply(this, arguments);

              Module.postRender();
            })
        }
    },
  `],
  [/(function _emscripten_set_main_loop_timing\s*\([\s\S]+?\)[\s\S]+?{)/gm, `
    $1
    mode = 1;
  `],
  /* [/(function _glBindFramebuffer[\s\S]+?\))[\s\S]+?(})/gm, `
    function _glBindFramebuffer(target, framebuffer) {
      if (!Module.display) {
        GLctx.bindFramebuffer(target, framebuffer ? GL.framebuffers[framebuffer] : null);
      } else {
        GLctx.bindFramebuffer(target, 0);
      }
    }
  `], */
];

let src = fs.readFileSync(process.argv[2], 'utf8');
replacements.forEach(r => {
  if (r[0].test(src)) {
    src = src.replace(r[0], r[1]);
  } else {
    throw new Error('failed to replace: ' + r[0]);
  }
});
process.stdout.write(src);
