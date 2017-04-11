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

// usage:
//
// hackerrank run <file>
// hackerrank start <language> <url>



// Engines
const engines = {
    javascript: {
        main: 'main.js',
        cmd: 'node',
        args: [],
        src: `function processData(input) {
    //Enter your code here
} 

process.stdin.resume();
process.stdin.setEncoding("ascii");
let _input = "";
process.stdin.on("data", function (input) {
    _input += input;
});

process.stdin.on("end", function () {
   processData(_input);
});
`
    },
    bash: {
        main: 'main.sh',
        cmd: 'bash',
        args: []
    },
    haskell: {
        main: 'Main.hs',
        cmd: 'runhaskell',
        args: [],
        src: `solve :: String -> String
solve s = s

main :: IO ()
main = do
  input <- getContents
  putStrLn $ solve input
`
    },
    erlang: {
        main: 'main.erl',
        cmd: 'erl',
        args: []
    },
    python: {
        main: 'main.py',
        cmd: 'python',
        args: []
    },
    python3: {
        main: 'main.py',
        cmd: 'python3',
        args: []
    }
};

if (Number(process.version[1]) < 6) {
    throw new Error('Use node >= v6');
}

const fs = require('fs'),
    path = require('path'),
    spawnSync = require('child_process').spawnSync,
    _ = require('lodash'),
    glob = require('glob'),
    request = require('request'),
    mkdirp = require('mkdirp'),
    AdmZip = require('adm-zip'),
    open = require("open"),
    EPSILON = 10e-2;

const cmd = process.argv[2];

if (cmd === 'start') {
    let engineName = process.argv[3].toLowerCase();
    let engine = engines[engineName];

    if (!engine) {
        throw new Error(`Engine "${engineName}" not found`);
    }
    console.log(`Engine: ${engineName}`);

    let challenge = process.argv[4].replace(/^(.*\/)/, '').replace(/([^\w\d-].*)$/, '');
    console.log(`Challenge: ${challenge}`);

    if (!challenge) {
        throw new Error(`No challenge found in "${process.argv[4]}`);
    }

    const base = 'https://www.hackerrank.com/rest/contests/master/challenges';
    const RESTUrl = `${base}/${challenge}`;
    const pdfUrl = `${base}/${challenge}/download_pdf?language=English`;
    const testsUrl = `${base}/${challenge}/download_testcases`;

    request(RESTUrl, (error, response, body) => {
        if (error) { throw new Error(error); }
        if (!error && response.statusCode == 200) {
            let res = JSON.parse(body);
            let { model } = res;

            if (model.languages.indexOf(engineName) === -1) {
                throw new Error(`Language "${engineName}" not allowed for challenge`);
            }

            let tpl = _.compact([
                model[`${engineName}_template_head`],
                model[`${engineName}_template`],
                model[`${engineName}_template_tail`]
            ]).join('\n');

            let onboarding = model.onboarding && model.onboarding[engineName];

            if (onboarding && onboarding.solution) {
                tpl = onboarding.solution;
            }

            let track = model.track;

            let dir = path.join(process.cwd(), 'domains',
                track.track_slug, track.slug, model.slug);

            mkdirp.sync(dir);

            process.stdout.write(`Project: ${dir}\n`);

            let file = path.join(dir, engine.main);
            let pdfFile = path.join(dir, 'README.pdf');

            if (!tpl && engine.src) {
                tpl = engine.src;
            }

            if (engineName === 'javascript') {
                // make the template executable as a script
                tpl = '#!/usr/bin/env node\n' + tpl
                // use strict, useful to catch idiot bugs
                tpl = '"use strict";\n\n' + tpl

                // expose the processData() function but only if present
                if (tpl.includes('processData'))
                    tpl += '\nmodule.exports = processData;\n'
            }

            try {
                let fileStat = fs.statSync(file);
                if (!fileStat.size) { throw new Error(`Empty ${file}`); }
            } catch (e) {
                fs.writeFileSync(file, tpl);
                process.stdout.write(`- Written: ${file}\n`);
            }
            require('child_process').exec(`subl "${dir}" "${file}"`);

            if (model.body_html) {
                fs.writeFileSync(path.join(dir, 'README.html'), model.body_html);
            }

            try {
                let pdfStat = fs.statSync(pdfFile);
                if (!pdfStat.size) { throw new Error(`Empty ${pdfFile}`); }
            } catch (e) {
                var pdfFileHandle = fs.createWriteStream(pdfFile);
                process.stdout.write(`- Download: ${pdfUrl}\n`);
                request(pdfUrl).pipe(pdfFileHandle).on('close', () => {
                    process.stdout.write(`- Written: ${pdfFile}\n`);
                    open(`file://${pdfFile}`);
                });
            }

            try {
                let inputStat = fs.statSync(path.join(dir, 'input'));
            } catch (e) {
                process.stdout.write(`- Download: ${testsUrl}\n`);
                request({
                    url: testsUrl,
                    encoding: null
                }, (error, response, body) => {
                    if (error) { throw new Error(error); }
                    var zip = new AdmZip(body);

                    var zipEntries = zip.getEntries();
                    console.log('- Extracting test cases:');
                    for (var i = 0; i < zipEntries.length; i++) {
                        console.log(`  * ${zipEntries[i].entryName}`);
                    }

                    zip.extractAllTo(dir, true);
                });
            }
        }
    });

    return;
} else if (cmd !== 'run') {
    process.exit(1);
}


let src = path.resolve(process.argv[3]),
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
            console.log = function() {
                runOutput.push(Array.prototype.slice.apply(arguments).join(' '));
            };
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
    process.stdout.write(`# ${path.relative(process.cwd(), inputFile)}`);
    let outputFile = inputFile.replace('/input/input', '/output/output'),
        input = fs.readFileSync(inputFile),
        output = fs.readFileSync(outputFile, 'utf-8'),
        runOutput = run(input),
        success = compare(runOutput, output);

    if (success) {
        process.stdout.write(' √\n');
    } else {
        process.stdout.write(` [WRONG]
## --- INPUT ----
${input}

## --- OUTPUT ---
${runOutput}

## --- SHOULD BE ---
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
