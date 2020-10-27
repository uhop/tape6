import State from './State.js';
import Tester from './Tester.js';
import Deferred from './Deferred.js';
import {setTimer} from './timer.js';

let tests = [],
  timerIsSet = false,
  reporter = null,
  testCounter = 0;

const processArgs = (name, options, testFn) => {
  // normalize arguments
  if (typeof name == 'function') {
    testFn = name;
    options = null;
    name = '';
  } else if (typeof name == 'object') {
    testFn = options;
    options = name;
    name = null;
  }
  if (typeof options == 'function') {
    testFn = options;
    options = null;
  }

  // normalize options
  options = {...options};
  if (name && typeof name == 'string') {
    options.name = name;
  }
  if (testFn && typeof testFn == 'function') {
    options.testFn = testFn;
  }
  if (!options.name && typeof options.testFn == 'function' && options.testFn.name) {
    options.name = options.testFn.name;
  }
  if (!options.name) {
    options.name = '(anonymous)';
  }

  return options;
};

export const test = async (name, options, testFn) => {
  options = processArgs(name, options, testFn);

  if (!timerIsSet) {
    // set HR timer
    if (typeof window == 'object' && window.performance && typeof window.performance.now == 'function') {
      setTimer(window.performance);
    } else {
      try {
        const {performance} = require('perf_hooks');
        setTimer(performance);
      } catch (error) {
        setTimer(Date);
      }
    }
    timerIsSet = true;
  }

  const deferred = new Deferred();
  tests.push({options, deferred});
  return deferred.promise;
};

export const getTests = () => tests;
export const clearTests = () => (tests = []);

export const getReporter = () => reporter;
export const setReporter = newReporter => (reporter = newReporter);

export const runTests = async (rootState, tests) => {
  for (let i = 0; i < tests.length; ++i) {
    const {options, deferred} = tests[i],
      testNumber = ++testCounter,
      state = new State(rootState, options),
      tester = new Tester(state, testNumber);
    try {
      state.emit({type: 'test', name: options.name, test: testNumber, time: state.time});
      await options.testFn(tester);
    } catch (error) {
      state.emit({
        name: 'UNEXPECTED EXCEPTION: ' + String(error),
        test: testNumber,
        marker: new Error(),
        time: timer.now(),
        operator: 'error',
        fail: true,
        data: {
          actual: error
        }
      });
    }
    state.emit({type: 'end', name: options.name, test: testNumber, time: state.timer.now(), fail: state.failed > 0, data: state});
    state.updateParent();
    deferred && deferred.resolve(state);
  }
};

// test() (an embedded test runner) is added here to ./Tester.js to avoid circular dependencies
Tester.prototype.test = async function test(name, options, testFn) {
  options = processArgs(name, options, testFn);
  await runTests(this.state, [{options}]);
};

export default test;

// TODO: add option "timeout" for a test
// TODO: add option "skip" for a test
// TODO: add option "todo" for a test
