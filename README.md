HackerRank challenge downloader & runner
========================================

* Easily download HackerRank challenges
* Run HackerRank challenges on input and compare to expected output

You can try it on [my HackerRank solutions](https://github.com/nheisterkamp/hackerrank-solutions).


## installation

```bash
npm i hackerrank
npm i --global hackerrank  << whatever you prefer
```


## Usage
```bash
hackerrank start <language> <url>
hackerrank start javascript "https://www.hackerrank.com/challenges/birthday-cake-candles"
```

The "start" command will also:
- automatically create empty test cases numbered 95...99
- write a `.current` file for easy launch (see below)
- if a soluce is found in the challenge (in warmup challenges), it will be downloaded in a file prefixed with `soluce_`

```bash
hackerrank run <path>
hackerrank run `cat .current`  << auto-launch the last downloaded challenge
hackerrank run domains/algorithms/warmup/birthday-cake-candles
```

NOTE: all the challenges don't have the same format, so the "run" command is not guaranteed to work. Sometimes it's easier to launch the test file directly with the correct inputs:

Example for JavaScript:
```bash
node `cat .current`/main.js  0< `cat .current`/input/input00.txt
```


## Folder structure
A downloaded challenge will have the following structure:

```
name/
  input/
    input<i>.txt
  output/
    output<i>.txt
  Main.hs
  main.js
  main.sh
  README.pdf
  README.html
```
