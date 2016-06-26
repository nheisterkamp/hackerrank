#!/usr/bin/env node
'use strict';

// find challenge to run (can also be running the folder/input files etc.)
//   if input or output is open, run only on open input/output
// find input folder
// find output folder
// for all files in input folder
//   run project
//     - if javascript try to require and use module.exports
//     - else run with spawn and stdio/stdout
//   if output then compare to output and print success
//     compare output with max error (epsilon)

// Engines
const engines = [
    // - Javascript
    {
        main: 'main.js',
        cmd: 'node',
        args: []
    },
    // - Bash
    {
        main: 'main.sh',
        cmd: 'bash',
        args: []
    },
    // - Haskell
    {
        main: 'Main.hs',
        cmd: 'runhaskell',
        args: []
    }
];

if (Number(process.version[1]) < 6) {
    throw new Error('Use node >= v6');
}

const fs = require('fs'),
    path = require('path'),
    spawnSync = require('child_process').spawnSync,
    _ = require('lodash'),
    glob = require('glob'),
    EPSILON = 10e-2;

let src = path.resolve(process.argv[2]),
    srcFile = path.basename(src),
    projectDir = path.resolve(src);

projectDir = projectDir.replace(/\/(input|output).*/, '');

if (path.extname(projectDir)) {
    projectDir = path.dirname(projectDir);
}

let engine = _.find(engines, engine => {
    try {
        return fs.statSync(path.join(projectDir, engine.main));
    } catch (e) {}
});

if (!engine) {
    throw new Error(`No challenge found at "${projectDir}"`);
}

let main = path.join(projectDir, engine.main);

// if engine provides run command use it
let run = engine.run;

if (engine.cmd === 'node') {
    // if engine is node try to use module export instead of spawn
    let module = require(main);
    if (_.isFunction(module)) {
        let consoleLog = console.log;
        run = input => {
            let runOutput = [];
            console.log = s => runOutput.push(s);
            module(input.toString());
            console.log = consoleLog;
            return runOutput.join('\n');
        };
    }
}

// define runner function based on cmd
if (!_.isFunction(run)) {
    run = input => {
        let res = spawnSync(engine.cmd,
                (engine.args || []).concat(main),
                { input }),
            out = res.stdout.toString().trim(),
            err = res.stderr.toString().trim();

        if (res.status) {
            console.log(`Child process exited (${res.status}): ${err}`);
            process.exit(res.status);
        } else if (err) {
            console.log(`## stderr: ${err}`);
        }

        return out;
    };
}

let inputDir = path.join(projectDir, 'input'),
    outputDir = path.join(projectDir, 'output');

function compare(a, b) {
    return _.isEqual(a, b);
}

function runOnInputFile(inputFile) {
    process.stdout.write(`# ${path.basename(inputFile)}`);
    let outputFile = inputFile.replace('/input/input', '/output/output'),
        input = fs.readFileSync(inputFile),
        output = fs.readFileSync(outputFile, 'utf-8'),
        runOutput = run(input),
        success = compare(runOutput, output);

    if (success) {
        process.stdout.write(' √\n');
    } else {
        process.stdout.write(` [WRONG]
${runOutput}
 -- should be --
${output}

`);
        process.exit(1);
    }
}

let srcInputFile = path.resolve(src.replace('/output/output', '/input/input'));

glob(path.join(inputDir, '*'), function(err, inputFiles) {
    if (inputFiles.indexOf(srcInputFile) !== -1) {
        inputFiles = [srcInputFile];
    }
    if (!inputFiles.length) {
        run();
    } else {
        inputFiles.forEach(runOnInputFile);
    }
    process.exit(0);
});
