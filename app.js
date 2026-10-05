/**
 * OmniCalc Pro — Scientific Computational Engine & Interactive Controller (app.js)
 * High-performance, pure vanilla JavaScript (ES6+) with zero dependencies.
 */
(function () {
  "use strict";

  // -------------------------------------------------------------------------
  // Web Audio API Sound Synthesizer (Zero External Dependencies)
  // -------------------------------------------------------------------------
  let audioCtx = null;
  let soundEnabled = true;

  function playKeyClickSound(frequency = 800, type = "sine", duration = 0.015) {
    if (!soundEnabled) return;
    try {
      if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) audioCtx = new AudioContext();
      }
      if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume();
      }
      if (!audioCtx) return;

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
  }

  // -------------------------------------------------------------------------
  // Calculator State Management
  // -------------------------------------------------------------------------
  const state = {
    expression: "(256 + 123) × (845÷25) =", // Pre-populated to match reference mockup
    currentOperand: "12810.2",
    isOperandActive: false,
    lastResult: 12810.2,
    isEvaluated: true,
    angleMode: "DEG",
    is2nd: false,
    memory: 0,
    precision: 12,
    autoParen: true,
    currentMode: "scientific",
    history: [
      { id: 1, expr: "(256 + 123) × (845÷25)", result: 12810.2, date: "12:45", isArchived: false },
      { id: 2, expr: "sin(4 * 256) + (π * (ln(1))", result: -0.82903757256, date: "12:42", isArchived: false },
      { id: 3, expr: "(256 + 123) × 6", result: 2274, date: "12:38", isArchived: false },
      { id: 4, expr: "tan(45) * cos(90)", result: 1, date: "12:30", isArchived: false }
    ],
    activeSidebarTab: "history"
  };

  // Load persisted state from localStorage if available
  try {
    const savedHistory = localStorage.getItem("omnicalc_history");
    if (savedHistory) {
      const parsed = JSON.parse(savedHistory);
      if (Array.isArray(parsed) && parsed.length > 0) state.history = parsed;
    }
    const savedAngle = localStorage.getItem("omnicalc_angle");
    if (savedAngle) state.angleMode = savedAngle;
    const savedSound = localStorage.getItem("omnicalc_sound");
    if (savedSound !== null) soundEnabled = savedSound === "true";
  } catch (err) {}

  // -------------------------------------------------------------------------
  // DOM Elements Cache
  // -------------------------------------------------------------------------
  const displayUpper = document.getElementById("displayUpper");
  const displayLower = document.getElementById("displayLower");
  const btnToggleAngle = document.getElementById("btnToggleAngle");
  const btnDegRad = document.getElementById("btnDegRad");
  const btn2nd = document.getElementById("btn2nd");
  const sidebarList = document.getElementById("sidebarList");
  const tabHistory = document.getElementById("tabHistory");
  const tabArchive = document.getElementById("tabArchive");
  const toastNotification = document.getElementById("toastNotification");
  const toastMessage = document.getElementById("toastMessage");
  const toggleSound = document.getElementById("toggleSound");
  const selectPrecision = document.getElementById("selectPrecision");
  const toggleAutoParen = document.getElementById("toggleAutoParen");

  if (toggleSound) toggleSound.checked = soundEnabled;
  updateAngleModeDisplay();

  // -------------------------------------------------------------------------
  // Mathematical Evaluation Engine (BODMAS Shunting-Yard Parser)
  // -------------------------------------------------------------------------

  function cleanFloat(val, eps = 1e-12) {
    if (!Number.isFinite(val)) return val;
    if (Math.abs(val) < eps) return 0;
    if (Math.abs(val - Math.round(val)) < eps) return Math.round(val);
    return parseFloat(Number(val).toPrecision(state.precision || 12));
  }

  function factorial(n) {
    if (!Number.isFinite(n) || n < 0 || Math.floor(n) !== n) {
      throw new Error("Invalid Factorial");
    }
    if (n > 170) return Infinity;
    let res = 1;
    for (let i = 2; i <= n; i++) res *= i;
    return res;
  }

  function permutations(n, r) {
    if (r < 0 || n < 0 || r > n) throw new Error("Invalid nPr");
    return factorial(n) / factorial(n - r);
  }

  function combinations(n, r) {
    if (r < 0 || n < 0 || r > n) throw new Error("Invalid nCr");
    return factorial(n) / (factorial(r) * factorial(n - r));
  }

  function toRadians(angle) {
    return state.angleMode === "DEG" ? (angle * Math.PI) / 180 : angle;
  }

  function fromRadians(angle) {
    return state.angleMode === "DEG" ? (angle * 180) / Math.PI : angle;
  }

  function safeSin(x) {
    const rad = toRadians(x);
    return cleanFloat(Math.sin(rad));
  }

  function safeCos(x) {
    const rad = toRadians(x);
    return cleanFloat(Math.cos(rad));
  }

  function safeTan(x) {
    const c = safeCos(x);
    if (Math.abs(c) < 1e-14) throw new Error("Tangent Undefined");
    const rad = toRadians(x);
    return cleanFloat(Math.tan(rad));
  }

  function safeCot(x) {
    const t = safeTan(x);
    if (Math.abs(t) < 1e-14) throw new Error("Cotangent Undefined");
    return cleanFloat(1 / t);
  }

  function safeSec(x) {
    const c = safeCos(x);
    if (Math.abs(c) < 1e-14) throw new Error("Secant Undefined");
    return cleanFloat(1 / c);
  }

  function safeCsc(x) {
    const s = safeSin(x);
    if (Math.abs(s) < 1e-14) throw new Error("Cosecant Undefined");
    return cleanFloat(1 / s);
  }

  function safeAsin(x) {
    if (x < -1 || x > 1) throw new Error("Domain Error: asin");
    return cleanFloat(fromRadians(Math.asin(x)));
  }

  function safeAcos(x) {
    if (x < -1 || x > 1) throw new Error("Domain Error: acos");
    return cleanFloat(fromRadians(Math.acos(x)));
  }

  function safeAtan(x) {
    return cleanFloat(fromRadians(Math.atan(x)));
  }

  function safeAcot(x) {
    if (Math.abs(x) < 1e-14) return fromRadians(Math.PI / 2);
    return cleanFloat(fromRadians(Math.atan(1 / x)));
  }

  function safeAsec(x) {
    if (Math.abs(x) < 1) throw new Error("Domain Error: asec");
    return cleanFloat(fromRadians(Math.acos(1 / x)));
  }

  function safeAcsc(x) {
    if (Math.abs(x) < 1) throw new Error("Domain Error: acsc");
    return cleanFloat(fromRadians(Math.asin(1 / x)));
  }

  /**
   * Core BODMAS Shunting-Yard Parser and Evaluator
   */
  function evaluateExpression(rawExpr) {
    if (!rawExpr || !rawExpr.trim()) return 0;

    let s = rawExpr
      .replace(/×/g, "*")
      .replace(/÷/g, "/")
      .replace(/−/g, "-")
      .replace(/π/g, "PI")
      .replace(/e\b/g, "E");

    // Auto-close unbalanced parentheses
    if (state.autoParen) {
      let openCount = 0;
      for (let ch of s) {
        if (ch === "(") openCount++;
        else if (ch === ")") openCount--;
      }
      while (openCount > 0) {
        s += ")";
        openCount--;
      }
    }

    const tokens = [];
    let i = 0;
    const len = s.length;
    const isDigit = (c) => (c >= "0" && c <= "9") || c === ".";
    const isAlpha = (c) => (c >= "a" && c <= "z") || (c >= "A" && c <= "Z");

    while (i < len) {
      const ch = s[i];
      if (/\s/.test(ch)) {
        i++;
        continue;
      }

      if (isDigit(ch)) {
        let numStr = "";
        let dotCount = 0;
        while (i < len && isDigit(s[i])) {
          if (s[i] === ".") {
            dotCount++;
            if (dotCount > 1) break;
          }
          numStr += s[i];
          i++;
        }
        tokens.push({ type: "NUM", val: parseFloat(numStr) });
        continue;
      }

      if (isAlpha(ch)) {
        let id = "";
        while (i < len && isAlpha(s[i])) {
          id += s[i];
          i++;
        }
        if (id === "PI") {
          tokens.push({ type: "NUM", val: Math.PI });
        } else if (id === "E") {
          tokens.push({ type: "NUM", val: Math.E });
        } else {
          tokens.push({ type: "FUNC", val: id.toLowerCase() });
        }
        continue;
      }

      if ("+-*/^!,()".indexOf(ch) !== -1) {
        tokens.push({ type: ch, val: ch });
        i++;
        continue;
      }

      if (ch === "%") {
        tokens.push({ type: "%", val: "%" });
        i++;
        continue;
      }

      i++;
    }

    // Implicit multiplication
    const processedTokens = [];
    for (let k = 0; k < tokens.length; k++) {
      const curr = tokens[k];
      const prev = k > 0 ? tokens[k - 1] : null;

      if (prev) {
        const prevCanMultiply = prev.type === "NUM" || prev.type === ")" || prev.type === "!" || prev.type === "%";
        const currCanMultiply = curr.type === "NUM" || curr.type === "(" || curr.type === "FUNC";

        if (prevCanMultiply && currCanMultiply) {
          processedTokens.push({ type: "*", val: "*" });
        }
      }
      processedTokens.push(curr);
    }

    // Unary minus & plus resolution
    const resolvedUnary = [];
    for (let k = 0; k < processedTokens.length; k++) {
      const curr = processedTokens[k];
      const prev = k > 0 ? processedTokens[k - 1] : null;

      const isUnaryContext = !prev || prev.type === "(" || prev.type === "," || "+-*/^".includes(prev.type);

      if (isUnaryContext && (curr.type === "-" || curr.type === "+")) {
        if (curr.type === "-") {
          resolvedUnary.push({ type: "UNARY_MINUS", val: "neg" });
        }
      } else {
        resolvedUnary.push(curr);
      }
    }

    // Shunting-Yard RPN Conversion
    const outputQueue = [];
    const opStack = [];

    const precedence = {
      "+": 1,
      "-": 1,
      "*": 2,
      "/": 2,
      "UNARY_MINUS": 3,
      "^": 4,
      "%": 5,
      "!": 5
    };

    const rightAssociative = {
      "^": true,
      "UNARY_MINUS": true
    };

    for (let k = 0; k < resolvedUnary.length; k++) {
      const token = resolvedUnary[k];

      if (token.type === "NUM") {
        outputQueue.push(token);
      } else if (token.type === "FUNC") {
        opStack.push(token);
      } else if (token.type === ",") {
        while (opStack.length && opStack[opStack.length - 1].type !== "(") {
          outputQueue.push(opStack.pop());
        }
        if (!opStack.length) throw new Error("Comma outside argument");
      } else if (token.type === "(") {
        opStack.push(token);
      } else if (token.type === ")") {
        while (opStack.length && opStack[opStack.length - 1].type !== "(") {
          outputQueue.push(opStack.pop());
        }
        if (!opStack.length) throw new Error("Mismatched parentheses");
        opStack.pop();

        if (opStack.length && opStack[opStack.length - 1].type === "FUNC") {
          outputQueue.push(opStack.pop());
        }
      } else if (token.type === "!" || token.type === "%") {
        outputQueue.push(token);
      } else {
        const op1 = token.type;
        while (opStack.length) {
          const top = opStack[opStack.length - 1];
          if (top.type === "(") break;

          const op2 = top.type;
          const p1 = precedence[op1] || 0;
          const p2 = precedence[op2] || 0;

          if (p2 > p1 || (p2 === p1 && !rightAssociative[op1])) {
            outputQueue.push(opStack.pop());
          } else {
            break;
          }
        }
        opStack.push(token);
      }
    }

    while (opStack.length) {
      const top = opStack.pop();
      if (top.type === "(" || top.type === ")") {
        throw new Error("Mismatched parentheses");
      }
      outputQueue.push(top);
    }

    // Evaluate RPN
    const evalStack = [];

    for (let k = 0; k < outputQueue.length; k++) {
      const item = outputQueue[k];

      if (item.type === "NUM") {
        evalStack.push(item.val);
      } else if (item.type === "UNARY_MINUS") {
        if (!evalStack.length) throw new Error("Syntax error");
        evalStack.push(-evalStack.pop());
      } else if (item.type === "!") {
        if (!evalStack.length) throw new Error("Syntax error");
        evalStack.push(factorial(evalStack.pop()));
      } else if (item.type === "%") {
        if (!evalStack.length) throw new Error("Syntax error");
        evalStack.push(evalStack.pop() / 100);
      } else if (item.type === "FUNC") {
        const fname = item.val;
        if (fname === "npr" || fname === "ncr") {
          if (evalStack.length < 2) throw new Error("Expected 2 arguments");
          const r = evalStack.pop();
          const n = evalStack.pop();
          evalStack.push(fname === "npr" ? permutations(n, r) : combinations(n, r));
        } else {
          if (!evalStack.length) throw new Error(`Missing argument for ${fname}`);
          const arg = evalStack.pop();

          switch (fname) {
            case "sin": evalStack.push(safeSin(arg)); break;
            case "cos": evalStack.push(safeCos(arg)); break;
            case "tan": evalStack.push(safeTan(arg)); break;
            case "cot": evalStack.push(safeCot(arg)); break;
            case "sec": evalStack.push(safeSec(arg)); break;
            case "csc": evalStack.push(safeCsc(arg)); break;
            case "asin": evalStack.push(safeAsin(arg)); break;
            case "acos": evalStack.push(safeAcos(arg)); break;
            case "atan": evalStack.push(safeAtan(arg)); break;
            case "acot": evalStack.push(safeAcot(arg)); break;
            case "asec": evalStack.push(safeAsec(arg)); break;
            case "acsc": evalStack.push(safeAcsc(arg)); break;
            case "sinh": evalStack.push(Math.sinh(arg)); break;
            case "cosh": evalStack.push(Math.cosh(arg)); break;
            case "tanh": evalStack.push(Math.tanh(arg)); break;
            case "sqrt":
              if (arg < 0) throw new Error("Domain Error: √ negative");
              evalStack.push(Math.sqrt(arg));
              break;
            case "cbrt": evalStack.push(Math.cbrt(arg)); break;
            case "ln":
              if (arg <= 0) throw new Error("Domain Error: ln <= 0");
              evalStack.push(Math.log(arg));
              break;
            case "log":
              if (arg <= 0) throw new Error("Domain Error: log <= 0");
              evalStack.push(Math.log10(arg));
              break;
            case "abs": evalStack.push(Math.abs(arg)); break;
            case "exp": evalStack.push(Math.exp(arg)); break;
            case "sqr": evalStack.push(arg * arg); break;
            default: throw new Error(`Unknown function: ${fname}`);
          }
        }
      } else {
        if (evalStack.length < 2) throw new Error("Syntax error");
        const b = evalStack.pop();
        const a = evalStack.pop();

        switch (item.type) {
          case "+": evalStack.push(a + b); break;
          case "-": evalStack.push(a - b); break;
          case "*": evalStack.push(a * b); break;
          case "/":
            if (Math.abs(b) < 1e-15) throw new Error("Cannot divide by 0");
            evalStack.push(a / b);
            break;
          case "^": evalStack.push(Math.pow(a, b)); break;
          default: throw new Error(`Unknown operator: ${item.type}`);
        }
      }
    }

    if (evalStack.length !== 1) throw new Error("Calculation Error");
    return cleanFloat(evalStack[0]);
  }

  // -------------------------------------------------------------------------
  // Display Formatting & UI Synchronization
  // -------------------------------------------------------------------------

  function formatDisplayNumber(num) {
    if (typeof num !== "number" || !Number.isFinite(num)) {
      return String(num);
    }
    const str = String(num);
    if (str.includes("e") || str.includes("E")) return str;

    const parts = str.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  }

  function updateDisplay() {
    displayUpper.textContent = state.expression;

    let formatted = state.currentOperand;
    if (!isNaN(formatted) && formatted.trim() !== "" && !formatted.endsWith(".")) {
      const numVal = parseFloat(formatted);
      const parts = formatted.split(".");
      const intFormatted = String(Math.floor(Math.abs(numVal))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      const prefix = numVal < 0 || formatted.startsWith("-") ? "-" : "";

      if (parts.length > 1) {
        formatted = prefix + intFormatted + "." + parts[1];
      } else {
        formatted = prefix + intFormatted;
      }
    }

    displayLower.textContent = formatted;

    displayLower.classList.remove("long-text", "super-long-text", "error-text");
    if (formatted.length > 18) {
      displayLower.classList.add("super-long-text");
    } else if (formatted.length > 11) {
      displayLower.classList.add("long-text");
    }

    const stdUpper = document.getElementById("standardUpper");
    const stdLower = document.getElementById("standardLower");
    if (stdUpper && stdLower) {
      stdUpper.textContent = state.expression;
      stdLower.textContent = formatted;
    }
  }

  function showError(msg) {
    displayLower.textContent = msg;
    displayLower.classList.add("error-text");
    playKeyClickSound(300, "sawtooth", 0.08);
  }

  function updateAngleModeDisplay() {
    if (btnDegRad) btnDegRad.textContent = state.angleMode === "DEG" ? "Deg" : "Rad";
  }

  function showToast(message) {
    if (!toastNotification || !toastMessage) return;
    toastMessage.textContent = message;
    toastNotification.classList.add("show");
    setTimeout(() => {
      toastNotification.classList.remove("show");
    }, 2200);
  }

  // -------------------------------------------------------------------------
  // Keypad Handlers
  // -------------------------------------------------------------------------

  function inputDigit(digit) {
    playKeyClickSound(650, "sine");

    if (state.isEvaluated) {
      state.expression = "";
      state.currentOperand = digit;
      state.isOperandActive = true;
      state.isEvaluated = false;
    } else {
      if (!state.isOperandActive || state.currentOperand === "0") {
        state.currentOperand = digit;
      } else {
        state.currentOperand += digit;
      }
      state.isOperandActive = true;
    }
    updateDisplay();
  }

  function inputDecimal() {
    playKeyClickSound(650, "sine");

    if (state.isEvaluated) {
      state.expression = "";
      state.currentOperand = "0.";
      state.isOperandActive = true;
      state.isEvaluated = false;
    } else {
      if (!state.isOperandActive) {
        state.currentOperand = "0.";
        state.isOperandActive = true;
      } else if (!state.currentOperand.includes(".")) {
        state.currentOperand += ".";
      }
    }
    updateDisplay();
  }

  function inputOperator(op) {
    playKeyClickSound(750, "sine");

    if (state.isEvaluated) {
      state.expression = state.currentOperand + " " + op + " ";
      state.currentOperand = "0";
      state.isOperandActive = false;
      state.isEvaluated = false;
    } else {
      if (state.isOperandActive) {
        state.expression += state.currentOperand + " " + op + " ";
        state.currentOperand = "0";
        state.isOperandActive = false;
      } else if (state.expression.trim().endsWith(")") || state.expression.trim().endsWith("!") || state.expression.trim().endsWith("%")) {
        state.expression += " " + op + " ";
      } else if (state.expression === "") {
        state.expression = state.currentOperand + " " + op + " ";
        state.currentOperand = "0";
        state.isOperandActive = false;
      } else {
        state.expression = state.expression.replace(/([+−×÷^]\s*)$/, op + " ");
      }
    }
    updateDisplay();
  }

  function executeEquals() {
    playKeyClickSound(900, "triangle", 0.03);

    let fullExpr = state.expression;
    if (state.isOperandActive) {
      fullExpr += state.currentOperand;
    } else if (state.expression === "") {
      fullExpr = state.currentOperand;
    }

    fullExpr = fullExpr.trim();
    if (!fullExpr) return;

    try {
      const result = evaluateExpression(fullExpr);

      if (!Number.isFinite(result) || isNaN(result)) {
        showError("Math Error");
        return;
      }

      const record = {
        id: Date.now() + Math.random(),
        expr: fullExpr,
        result: result,
        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isArchived: false
      };
      state.history.unshift(record);
      saveHistoryToStorage();
      renderSidebarList();

      state.expression = fullExpr + " =";
      state.currentOperand = String(result);
      state.lastResult = result;
      state.isEvaluated = true;
      state.isOperandActive = false;
      updateDisplay();

    } catch (err) {
      showError(err.message || "Syntax Error");
    }
  }

  function clearAll() {
    playKeyClickSound(500, "square", 0.02);
    state.expression = "";
    state.currentOperand = "0";
    state.isOperandActive = false;
    state.isEvaluated = false;
    updateDisplay();
  }

  function clearEntry() {
    playKeyClickSound(500, "square", 0.02);
    state.currentOperand = "0";
    state.isOperandActive = false;
    updateDisplay();
  }

  function backspace() {
    playKeyClickSound(400, "square", 0.015);
    if (state.isEvaluated) {
      clearAll();
      return;
    }
    if (state.isOperandActive && state.currentOperand.length > 1) {
      state.currentOperand = state.currentOperand.slice(0, -1);
    } else {
      state.currentOperand = "0";
      state.isOperandActive = false;
    }
    updateDisplay();
  }

  function negate() {
    playKeyClickSound(650, "sine");
    if (state.currentOperand === "0") return;
    if (state.currentOperand.startsWith("-")) {
      state.currentOperand = state.currentOperand.substring(1);
    } else {
      state.currentOperand = "-" + state.currentOperand;
    }
    state.isOperandActive = true;
    updateDisplay();
  }

  function inputConstant(constName) {
    playKeyClickSound(700, "sine");
    const val = constName === "π" ? Math.PI : Math.E;
    state.currentOperand = String(cleanFloat(val));
    state.isOperandActive = true;
    if (state.isEvaluated) {
      state.expression = "";
      state.isEvaluated = false;
    }
    updateDisplay();
  }

  function inputFunction(funcName) {
    playKeyClickSound(720, "sine");

    let effectiveFunc = funcName;
    if (state.is2nd) {
      const map2nd = {
        "sin": "asin", "cos": "acos", "tan": "atan",
        "cot": "acot", "sec": "asec", "csc": "acsc",
        "ln": "exp", "log": "pow2", "sqrt": "cbrt"
      };
      if (map2nd[funcName]) effectiveFunc = map2nd[funcName];
    }

    if (state.isOperandActive) {
      state.expression += `${effectiveFunc}(${state.currentOperand}) `;
      state.currentOperand = "0";
      state.isOperandActive = false;
    } else {
      state.expression += `${effectiveFunc}(`;
      state.currentOperand = "0";
      state.isOperandActive = false;
    }
    state.isEvaluated = false;
    updateDisplay();
  }

  function inputParenthesis(type) {
    playKeyClickSound(700, "sine");
    if (type === "(") {
      if (state.isEvaluated) {
        state.expression = "(";
        state.currentOperand = "0";
        state.isOperandActive = false;
        state.isEvaluated = false;
      } else {
        if (state.isOperandActive) {
          state.expression += state.currentOperand + " × (";
          state.currentOperand = "0";
          state.isOperandActive = false;
        } else if (state.expression.trim().endsWith(")") || state.expression.trim().endsWith("!")) {
          state.expression += " × (";
        } else {
          state.expression += "(";
        }
      }
    } else {
      if (state.isOperandActive) {
        state.expression += state.currentOperand + ")";
        state.currentOperand = "0";
        state.isOperandActive = false;
      } else {
        state.expression += ")";
      }
    }
    updateDisplay();
  }

  function inputSquare() {
    playKeyClickSound(720, "sine");
    if (state.isOperandActive) {
      state.expression += `sqr(${state.currentOperand}) `;
      state.currentOperand = "0";
      state.isOperandActive = false;
    } else {
      inputOperator("^");
      inputDigit("2");
    }
    updateDisplay();
  }

  function inputCube() {
    playKeyClickSound(720, "sine");
    if (state.isOperandActive) {
      const val = parseFloat(state.currentOperand);
      state.currentOperand = String(cleanFloat(val * val * val));
    } else {
      inputOperator("^");
      inputDigit("3");
    }
    updateDisplay();
  }

  function inputPowerE() {
    playKeyClickSound(720, "sine");
    state.expression += "exp(";
    state.currentOperand = "0";
    state.isOperandActive = false;
    updateDisplay();
  }

  function inputPower2() {
    playKeyClickSound(720, "sine");
    state.expression += "2^(";
    state.currentOperand = "0";
    state.isOperandActive = false;
    updateDisplay();
  }

  function inputInverse() {
    playKeyClickSound(720, "sine");
    if (state.isOperandActive) {
      const val = parseFloat(state.currentOperand);
      if (Math.abs(val) < 1e-15) {
        showError("Cannot divide by 0");
        return;
      }
      state.currentOperand = String(cleanFloat(1 / val));
    } else {
      state.expression += "1/(";
      state.currentOperand = "0";
      state.isOperandActive = false;
    }
    updateDisplay();
  }

  function inputAbs() {
    playKeyClickSound(720, "sine");
    if (state.isOperandActive) {
      const val = parseFloat(state.currentOperand);
      state.currentOperand = String(Math.abs(val));
    } else {
      state.expression += "abs(";
      state.currentOperand = "0";
      state.isOperandActive = false;
    }
    updateDisplay();
  }

  function inputPower10() {
    playKeyClickSound(720, "sine");
    state.expression += "10^(";
    state.currentOperand = "0";
    state.isOperandActive = false;
    updateDisplay();
  }

  function toggleAngleMode() {
    playKeyClickSound(800, "sine");
    state.angleMode = state.angleMode === "DEG" ? "RAD" : "DEG";
    try {
      localStorage.setItem("omnicalc_angle", state.angleMode);
    } catch (e) {}
    updateAngleModeDisplay();
    showToast(`Angle Mode: ${state.angleMode}`);
  }

  function toggle2ndMode() {
    playKeyClickSound(850, "sine");
    state.is2nd = !state.is2nd;
    btn2nd?.classList.toggle("active-toggle", state.is2nd);

    const btnSin = document.getElementById("btnSin");
    const btnCos = document.getElementById("btnCos");
    const btnTan = document.getElementById("btnTan");
    const btnCot = document.getElementById("btnCot");
    const btnSec = document.getElementById("btnSec");
    const btnCsc = document.getElementById("btnCsc");

    if (state.is2nd) {
      if (btnSin) btnSin.textContent = "sin⁻¹";
      if (btnCos) btnCos.textContent = "cos⁻¹";
      if (btnTan) btnTan.textContent = "tan⁻¹";
      if (btnCot) btnCot.textContent = "cot⁻¹";
      if (btnSec) btnSec.textContent = "sec⁻¹";
      if (btnCsc) btnCsc.textContent = "csc⁻¹";
    } else {
      if (btnSin) btnSin.textContent = "sin";
      if (btnCos) btnCos.textContent = "cos";
      if (btnTan) btnTan.textContent = "tan";
      if (btnCot) btnCot.textContent = "cot";
      if (btnSec) btnSec.textContent = "sec";
      if (btnCsc) btnCsc.textContent = "csc";
    }
    updateDisplay();
  }

  // Memory Register Functions
  function memAdd() {
    playKeyClickSound(750, "sine");
    state.memory += parseFloat(state.currentOperand) || 0;
    showToast(`Memory: ${formatDisplayNumber(state.memory)}`);
    updateDisplay();
  }

  function memRecall() {
    playKeyClickSound(750, "sine");
    state.currentOperand = String(state.memory);
    state.isOperandActive = true;
    updateDisplay();
  }

  function memClear() {
    playKeyClickSound(750, "sine");
    state.memory = 0;
    showToast("Memory Cleared");
    updateDisplay();
  }

  // -------------------------------------------------------------------------
  // Event Delegation for Keypad
  // -------------------------------------------------------------------------
  function handleKeypadAction(action, val) {
    switch (action) {
      case "num": inputDigit(val); break;
      case "decimal": inputDecimal(); break;
      case "op": inputOperator(val); break;
      case "equals": executeEquals(); break;
      case "clear-all": clearAll(); break;
      case "clear-entry": clearEntry(); break;
      case "backspace": backspace(); break;
      case "negate": negate(); break;
      case "const": inputConstant(val); break;
      case "func": inputFunction(val); break;
      case "paren-open": inputParenthesis("("); break;
      case "paren-close": inputParenthesis(")"); break;
      case "percent": inputOperator("%"); break;
      case "sq": inputSquare(); break;
      case "cube": inputCube(); break;
      case "power-e": inputPowerE(); break;
      case "power-2": inputPower2(); break;
      case "inverse": inputInverse(); break;
      case "abs": inputAbs(); break;
      case "power10": inputPower10(); break;
      case "toggle-2nd": toggle2ndMode(); break;
      case "toggle-deg-rad": toggleAngleMode(); break;
      case "mem-add": memAdd(); break;
      case "mem-recall": memRecall(); break;
      case "mem-clear": memClear(); break;
      default: break;
    }
  }

  document.getElementById("keypadMatrix")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".calc-btn");
    if (!btn) return;
    handleKeypadAction(btn.dataset.action, btn.dataset.val);
  });

  document.getElementById("standardKeypad")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".calc-btn");
    if (!btn) return;
    handleKeypadAction(btn.dataset.action, btn.dataset.val);
  });

  // -------------------------------------------------------------------------
  // Sub-Toolbar Dropdowns
  // -------------------------------------------------------------------------
  const pillTrig = document.getElementById("pillTrig");
  const menuTrig = document.getElementById("menuTrig");
  const pillProb = document.getElementById("pillProb");
  const menuProb = document.getElementById("menuProb");
  const pillCalc = document.getElementById("pillCalc");
  const menuCalc = document.getElementById("menuCalc");

  function closeAllDropdowns() {
    [menuTrig, menuProb, menuCalc].forEach(m => m?.classList.remove("show"));
    [pillTrig, pillProb, pillCalc].forEach(p => p?.classList.remove("open"));
  }

  function setupDropdown(trigger, menu) {
    if (!trigger || !menu) return;
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = menu.classList.contains("show");
      closeAllDropdowns();
      if (!isOpen) {
        menu.classList.add("show");
        trigger.classList.add("open");
      }
    });

    menu.addEventListener("click", (e) => {
      const item = e.target.closest(".dropdown-item");
      if (!item) return;
      const action = item.dataset.action;
      const val = item.dataset.val;

      if (action === "func") {
        inputFunction(val);
      } else if (action === "op") {
        inputOperator(val);
      } else if (action === "prob-rand") {
        state.currentOperand = String(Math.random().toFixed(6));
        state.isOperandActive = true;
        updateDisplay();
      } else if (action === "prob-randint") {
        state.currentOperand = String(Math.floor(Math.random() * 100) + 1);
        state.isOperandActive = true;
        updateDisplay();
      } else if (action === "calc-deriv") {
        showToast("Numerical d/dx: Evaluate f(x+h) - f(x) / h");
        state.expression += "d/dx(";
        state.isOperandActive = false;
        updateDisplay();
      } else if (action === "calc-integral") {
        showToast("Definite ∫: Simpson's Rule Approximation");
        state.expression += "∫(";
        state.isOperandActive = false;
        updateDisplay();
      } else if (action === "calc-sum") {
        state.expression += "Σ(";
        state.isOperandActive = false;
        updateDisplay();
      }
      closeAllDropdowns();
    });
  }

  setupDropdown(pillTrig, menuTrig);
  setupDropdown(pillProb, menuProb);
  setupDropdown(pillCalc, menuCalc);

  document.addEventListener("click", () => {
    closeAllDropdowns();
  });

  btnToggleAngle?.addEventListener("click", toggleAngleMode);

  // -------------------------------------------------------------------------
  // Physical Keyboard Binding
  // -------------------------------------------------------------------------
  window.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;

    const key = e.key;

    function triggerButtonAnimation(selector) {
      const btn = document.querySelector(selector);
      if (btn) {
        btn.classList.add("simulate-active");
        setTimeout(() => btn.classList.remove("simulate-active"), 120);
      }
    }

    if (key >= "0" && key <= "9") {
      e.preventDefault();
      triggerButtonAnimation(`.btn-num[data-val="${key}"]`);
      inputDigit(key);
    } else if (key === ".") {
      e.preventDefault();
      triggerButtonAnimation('.calc-btn[data-action="decimal"]');
      inputDecimal();
    } else if (key === "+") {
      e.preventDefault();
      triggerButtonAnimation('.calc-btn[data-val="+"]');
      inputOperator("+");
    } else if (key === "-") {
      e.preventDefault();
      triggerButtonAnimation('.calc-btn[data-val="−"]');
      inputOperator("−");
    } else if (key === "*") {
      e.preventDefault();
      triggerButtonAnimation('.calc-btn[data-val="×"]');
      inputOperator("×");
    } else if (key === "/") {
      e.preventDefault();
      triggerButtonAnimation('.calc-btn[data-val="÷"]');
      inputOperator("÷");
    } else if (key === "Enter" || key === "=") {
      e.preventDefault();
      triggerButtonAnimation('.calc-btn[data-action="equals"]');
      executeEquals();
    } else if (key === "Backspace") {
      e.preventDefault();
      triggerButtonAnimation('.calc-btn[data-action="backspace"]');
      backspace();
    } else if (key === "Escape") {
      e.preventDefault();
      triggerButtonAnimation('.calc-btn[data-action="clear-all"]');
      clearAll();
    } else if (key === "(") {
      e.preventDefault();
      triggerButtonAnimation('.calc-btn[data-action="paren-open"]');
      inputParenthesis("(");
    } else if (key === ")") {
      e.preventDefault();
      triggerButtonAnimation('.calc-btn[data-action="paren-close"]');
      inputParenthesis(")");
    } else if (key === "^") {
      e.preventDefault();
      triggerButtonAnimation('.calc-btn[data-val="^"]');
      inputOperator("^");
    } else if (key === "%") {
      e.preventDefault();
      triggerButtonAnimation('.calc-btn[data-action="percent"]');
      inputOperator("%");
    } else if (key === "!") {
      e.preventDefault();
      triggerButtonAnimation('.calc-btn[data-val="!"]');
      inputOperator("!");
    }
  });

  // -------------------------------------------------------------------------
  // History & Archive Drawer Management
  // -------------------------------------------------------------------------
  function saveHistoryToStorage() {
    try {
      localStorage.setItem("omnicalc_history", JSON.stringify(state.history.slice(0, 100)));
    } catch (e) {}
  }

  function renderSidebarList() {
    const isHistory = state.activeSidebarTab === "history";
    const items = state.history.filter(item => isHistory ? !item.isArchived : item.isArchived);

    if (!sidebarList) return;
    sidebarList.innerHTML = "";

    if (items.length === 0) {
      const emptyDiv = document.createElement("div");
      emptyDiv.className = "history-empty-state";
      emptyDiv.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        <span>${isHistory ? "No calculation history yet.<br>Equations you calculate appear here." : "No archived calculations.<br>Bookmark items to view here."}</span>
      `;
      sidebarList.appendChild(emptyDiv);
      return;
    }

    items.forEach(record => {
      const div = document.createElement("div");
      div.className = "history-item";
      div.setAttribute("role", "button");
      div.setAttribute("tabindex", "0");
      div.dataset.id = record.id;

      div.innerHTML = `
        <div class="history-expr">${record.expr} =</div>
        <div class="history-result">${formatDisplayNumber(record.result)}</div>
      `;

      div.addEventListener("click", () => {
        playKeyClickSound(600, "sine");
        state.expression = record.expr + " =";
        state.currentOperand = String(record.result);
        state.isEvaluated = true;
        state.isOperandActive = false;
        updateDisplay();
        showToast("Recalled into active display");
      });

      sidebarList.appendChild(div);
    });
  }

  tabHistory?.addEventListener("click", () => {
    state.activeSidebarTab = "history";
    tabHistory.classList.add("active");
    tabArchive?.classList.remove("active");
    renderSidebarList();
  });

  tabArchive?.addEventListener("click", () => {
    state.activeSidebarTab = "archive";
    tabArchive.classList.add("active");
    tabHistory?.classList.remove("active");
    renderSidebarList();
  });

  document.getElementById("btnClearHistory")?.addEventListener("click", () => {
    state.history = [];
    saveHistoryToStorage();
    renderSidebarList();
    showToast("History cleared");
  });

  document.getElementById("btnExportHistory")?.addEventListener("click", () => {
    const textData = state.history
      .map(h => `${h.date} | ${h.expr} = ${h.result}`)
      .join("\n");
    const blob = new Blob([textData], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `omnicalc-history-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("History exported as text file");
  });

  document.getElementById("btnShareHistory")?.addEventListener("click", () => {
    const textData = state.history
      .slice(0, 10)
      .map(h => `${h.expr} = ${h.result}`)
      .join("\n");
    if (textData) {
      navigator.clipboard.writeText(textData);
      showToast("History copied to clipboard");
    } else {
      showToast("History is currently empty");
    }
  });

  document.getElementById("btnSaveHistoryLink")?.addEventListener("click", () => {
    const textData = state.history
      .map(h => `${h.date} | ${h.expr} = ${h.result}`)
      .join("\n");
    const blob = new Blob([textData], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `calculator-history.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("History saved");
  });

  renderSidebarList();

  // -------------------------------------------------------------------------
  // Alternate Mode Panels
  // -------------------------------------------------------------------------
  const modeTabs = document.querySelectorAll(".nav-tab-item");
  const scientificPane = document.getElementById("scientificPane");
  const sidebarPane = document.getElementById("sidebarPane");
  const panelStandard = document.getElementById("panelStandard");
  const panelGraph = document.getElementById("panelGraph");
  const panelProgrammer = document.getElementById("panelProgrammer");
  const panelConverter = document.getElementById("panelConverter");
  const subToolbar = document.getElementById("subToolbar");

  function switchMode(newMode) {
    state.currentMode = newMode;
    modeTabs.forEach(t => t.classList.toggle("active", t.dataset.mode === newMode));

    [panelStandard, panelGraph, panelProgrammer, panelConverter].forEach(p => p?.classList.remove("active"));

    if (newMode === "scientific") {
      scientificPane.style.display = "flex";
      sidebarPane.style.display = "flex";
      subToolbar.style.display = "flex";
    } else if (newMode === "standard") {
      scientificPane.style.display = "none";
      sidebarPane.style.display = "none";
      subToolbar.style.display = "none";
      panelStandard?.classList.add("active");
    } else if (newMode === "graph") {
      scientificPane.style.display = "none";
      sidebarPane.style.display = "none";
      subToolbar.style.display = "none";
      panelGraph?.classList.add("active");
      resizeAndDrawGraph();
    } else if (newMode === "programmer") {
      scientificPane.style.display = "none";
      sidebarPane.style.display = "none";
      subToolbar.style.display = "none";
      panelProgrammer?.classList.add("active");
      updateProgrammerDisplays();
    } else if (newMode === "converter") {
      scientificPane.style.display = "none";
      sidebarPane.style.display = "none";
      subToolbar.style.display = "none";
      panelConverter?.classList.add("active");
      initUnitConverter();
    }
  }

  modeTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      switchMode(tab.dataset.mode);
    });
  });

  // -------------------------------------------------------------------------
  // Interactive Function Graph Plotter
  // -------------------------------------------------------------------------
  const graphCanvas = document.getElementById("graphCanvas");
  const graphCtx = graphCanvas?.getContext("2d");
  const graphInput = document.getElementById("graphInput");
  const btnPlotGraph = document.getElementById("btnPlotGraph");
  const btnGraphReset = document.getElementById("btnGraphReset");

  let graphState = {
    centerX: 0,
    centerY: 0,
    scaleX: 35,
    scaleY: 35,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0
  };

  function resizeAndDrawGraph() {
    if (!graphCanvas || !graphCtx) return;
    const rect = graphCanvas.getBoundingClientRect();
    graphCanvas.width = rect.width;
    graphCanvas.height = rect.height;

    if (graphState.centerX === 0 && graphState.centerY === 0) {
      graphState.centerX = rect.width / 2;
      graphState.centerY = rect.height / 2;
    }
    drawGraph();
  }

  function drawGraph() {
    if (!graphCtx || !graphCanvas) return;
    const width = graphCanvas.width;
    const height = graphCanvas.height;
    const ctx = graphCtx;

    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;

    const startX = Math.floor(-graphState.centerX / graphState.scaleX);
    const endX = Math.ceil((width - graphState.centerX) / graphState.scaleX);

    for (let x = startX; x <= endX; x++) {
      const pixelX = graphState.centerX + x * graphState.scaleX;
      ctx.beginPath();
      ctx.moveTo(pixelX, 0);
      ctx.lineTo(pixelX, height);
      ctx.stroke();
    }

    const startY = Math.floor(-graphState.centerY / graphState.scaleY);
    const endY = Math.ceil((height - graphState.centerY) / graphState.scaleY);

    for (let y = startY; y <= endY; y++) {
      const pixelY = graphState.centerY + y * graphState.scaleY;
      ctx.beginPath();
      ctx.moveTo(0, pixelY);
      ctx.lineTo(width, pixelY);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(0, graphState.centerY);
    ctx.lineTo(width, graphState.centerY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(graphState.centerX, 0);
    ctx.lineTo(graphState.centerX, height);
    ctx.stroke();

    const formula = graphInput ? graphInput.value.trim() : "sin(x)";
    if (!formula) return;

    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    let isFirstPoint = true;
    for (let px = 0; px <= width; px += 2) {
      const mathX = (px - graphState.centerX) / graphState.scaleX;

      try {
        const exprWithVal = formula.replace(/\bx\b/gi, `(${mathX})`);
        const mathY = evaluateExpression(exprWithVal);

        if (Number.isFinite(mathY)) {
          const py = graphState.centerY - mathY * graphState.scaleY;
          if (isFirstPoint) {
            ctx.moveTo(px, py);
            isFirstPoint = false;
          } else {
            ctx.lineTo(px, py);
          }
        } else {
          isFirstPoint = true;
        }
      } catch (e) {
        isFirstPoint = true;
      }
    }
    ctx.stroke();
  }

  btnPlotGraph?.addEventListener("click", () => {
    drawGraph();
    showToast("Function plotted");
  });

  btnGraphReset?.addEventListener("click", () => {
    if (!graphCanvas) return;
    graphState.centerX = graphCanvas.width / 2;
    graphState.centerY = graphCanvas.height / 2;
    graphState.scaleX = 35;
    graphState.scaleY = 35;
    drawGraph();
  });

  graphCanvas?.addEventListener("mousedown", (e) => {
    graphState.isDragging = true;
    graphState.dragStartX = e.clientX - graphState.centerX;
    graphState.dragStartY = e.clientY - graphState.centerY;
  });

  window.addEventListener("mousemove", (e) => {
    if (!graphState.isDragging) return;
    graphState.centerX = e.clientX - graphState.dragStartX;
    graphState.centerY = e.clientY - graphState.dragStartY;
    drawGraph();
  });

  window.addEventListener("mouseup", () => {
    graphState.isDragging = false;
  });

  graphCanvas?.addEventListener("wheel", (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    graphState.scaleX = Math.max(10, Math.min(250, graphState.scaleX * zoomFactor));
    graphState.scaleY = Math.max(10, Math.min(250, graphState.scaleY * zoomFactor));
    drawGraph();
  });

  // -------------------------------------------------------------------------
  // Programmer Calculator Engine
  // -------------------------------------------------------------------------
  function updateProgrammerDisplays() {
    const num = Math.floor(parseFloat(state.currentOperand) || 0);
    const hex = (num >>> 0).toString(16).toUpperCase();
    const dec = String(num);
    const oct = (num >>> 0).toString(8);
    let bin = (num >>> 0).toString(2).padStart(16, "0");
    bin = bin.match(/.{1,4}/g)?.join(" ") || bin;

    const progHex = document.getElementById("progHex");
    const progDec = document.getElementById("progDec");
    const progOct = document.getElementById("progOct");
    const progBin = document.getElementById("progBin");

    if (progHex) progHex.textContent = hex;
    if (progDec) progDec.textContent = dec;
    if (progOct) progOct.textContent = oct;
    if (progBin) progBin.textContent = bin;
  }

  document.getElementById("progKeypad")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".calc-btn");
    if (!btn) return;
    const action = btn.dataset.action;
    const val = btn.dataset.val;

    if (action === "num") {
      inputDigit(val);
      updateProgrammerDisplays();
    } else if (action === "prog-and") {
      inputOperator("&");
    } else if (action === "prog-or") {
      inputOperator("|");
    } else if (action === "prog-xor") {
      inputOperator("^");
    } else if (action === "prog-not") {
      const num = Math.floor(parseFloat(state.currentOperand) || 0);
      state.currentOperand = String(~num);
      state.isOperandActive = true;
      updateProgrammerDisplays();
      updateDisplay();
    } else if (action === "clear-all") {
      clearAll();
      updateProgrammerDisplays();
    } else if (action === "backspace") {
      backspace();
      updateProgrammerDisplays();
    } else if (action === "equals") {
      executeEquals();
      updateProgrammerDisplays();
    }
  });

  // -------------------------------------------------------------------------
  // Unit Converter Logic
  // -------------------------------------------------------------------------
  const convCategory = document.getElementById("convCategory");
  const convUnit1 = document.getElementById("convUnit1");
  const convUnit2 = document.getElementById("convUnit2");
  const convInput1 = document.getElementById("convInput1");
  const convInput2 = document.getElementById("convInput2");

  const conversionData = {
    length: {
      units: ["Meters", "Kilometers", "Miles", "Feet", "Inches", "Centimeters"],
      toBase: { "Meters": 1, "Kilometers": 1000, "Miles": 1609.344, "Feet": 0.3048, "Inches": 0.0254, "Centimeters": 0.01 }
    },
    weight: {
      units: ["Kilograms", "Grams", "Pounds", "Ounces", "Metric Tons"],
      toBase: { "Kilograms": 1, "Grams": 0.001, "Pounds": 0.453592, "Ounces": 0.0283495, "Metric Tons": 1000 }
    },
    temperature: {
      units: ["Celsius", "Fahrenheit", "Kelvin"],
      custom: true
    },
    area: {
      units: ["Square Meters", "Acres", "Hectares", "Square Feet", "Square Kilometers"],
      toBase: { "Square Meters": 1, "Acres": 4046.86, "Hectares": 10000, "Square Feet": 0.092903, "Square Kilometers": 1000000 }
    },
    data: {
      units: ["Bytes", "Kilobytes (KB)", "Megabytes (MB)", "Gigabytes (GB)", "Terabytes (TB)"],
      toBase: { "Bytes": 1, "Kilobytes (KB)": 1024, "Megabytes (MB)": 1048576, "Gigabytes (GB)": 1073741824, "Terabytes (TB)": 1099511627776 }
    },
    speed: {
      units: ["km/h", "mph", "m/s", "Knots"],
      toBase: { "m/s": 1, "km/h": 0.277778, "mph": 0.44704, "Knots": 0.514444 }
    }
  };

  function initUnitConverter() {
    if (!convCategory) return;
    const cat = convCategory.value;
    const data = conversionData[cat];

    convUnit1.innerHTML = "";
    convUnit2.innerHTML = "";

    data.units.forEach((u, idx) => {
      convUnit1.add(new Option(u, u, idx === 0, idx === 0));
      convUnit2.add(new Option(u, u, idx === 1, idx === 1));
    });

    calculateConversion();
  }

  function calculateConversion() {
    if (!convInput1 || !convInput2) return;
    const cat = convCategory.value;
    const val = parseFloat(convInput1.value) || 0;
    const u1 = convUnit1.value;
    const u2 = convUnit2.value;

    if (cat === "temperature") {
      let cVal = val;
      if (u1 === "Fahrenheit") cVal = (val - 32) * (5 / 9);
      else if (u1 === "Kelvin") cVal = val - 273.15;

      let res = cVal;
      if (u2 === "Fahrenheit") res = (cVal * (9 / 5)) + 32;
      else if (u2 === "Kelvin") res = cVal + 273.15;

      convInput2.value = res.toFixed(4);
    } else {
      const rates = conversionData[cat].toBase;
      const base = val * (rates[u1] || 1);
      const out = base / (rates[u2] || 1);
      convInput2.value = out.toFixed(6).replace(/\.?0+$/, "");
    }
  }

  convCategory?.addEventListener("change", initUnitConverter);
  convUnit1?.addEventListener("change", calculateConversion);
  convUnit2?.addEventListener("change", calculateConversion);
  convInput1?.addEventListener("input", calculateConversion);

  // -------------------------------------------------------------------------
  // Theme Switcher (Dark Obsidian / Light Slate)
  // -------------------------------------------------------------------------
  const btnThemeToggle = document.getElementById("btnThemeToggle");

  function setTheme(isLight) {
    if (isLight) {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    try {
      localStorage.setItem("omnicalc_theme", isLight ? "light" : "dark");
    } catch (e) {}
  }

  btnThemeToggle?.addEventListener("click", () => {
    const isCurrentLight = document.documentElement.getAttribute("data-theme") === "light";
    setTheme(!isCurrentLight);
    showToast(`Theme: ${!isCurrentLight ? "Light Mode" : "Dark Obsidian"}`);
  });

  try {
    const savedTheme = localStorage.getItem("omnicalc_theme");
    if (savedTheme === "light") setTheme(true);
  } catch (e) {}

  // -------------------------------------------------------------------------
  // Side Drawer & Modal Dialogs
  // -------------------------------------------------------------------------
  const btnHamburger = document.getElementById("btnHamburger");
  const drawerOverlay = document.getElementById("drawerOverlay");
  const btnCloseDrawer = document.getElementById("btnCloseDrawer");
  const btnKeyboardShortcuts = document.getElementById("btnKeyboardShortcuts");
  const modalShortcuts = document.getElementById("modalShortcuts");
  const btnCloseShortcuts = document.getElementById("btnCloseShortcuts");
  const btnDrawerShortcuts = document.getElementById("btnDrawerShortcuts");

  btnHamburger?.addEventListener("click", () => {
    drawerOverlay.classList.add("open");
  });

  btnCloseDrawer?.addEventListener("click", () => {
    drawerOverlay.classList.remove("open");
  });

  drawerOverlay?.addEventListener("click", (e) => {
    if (e.target === drawerOverlay) drawerOverlay.classList.remove("open");
  });

  btnKeyboardShortcuts?.addEventListener("click", () => {
    modalShortcuts.classList.add("open");
  });

  btnDrawerShortcuts?.addEventListener("click", () => {
    drawerOverlay.classList.remove("open");
    modalShortcuts.classList.add("open");
  });

  btnCloseShortcuts?.addEventListener("click", () => {
    modalShortcuts.classList.remove("open");
  });

  modalShortcuts?.addEventListener("click", (e) => {
    if (e.target === modalShortcuts) modalShortcuts.classList.remove("open");
  });

  toggleSound?.addEventListener("change", (e) => {
    soundEnabled = e.target.checked;
    try {
      localStorage.setItem("omnicalc_sound", String(soundEnabled));
    } catch (err) {}
    showToast(`Sound: ${soundEnabled ? "Enabled" : "Muted"}`);
  });

  selectPrecision?.addEventListener("change", (e) => {
    state.precision = parseInt(e.target.value, 10);
    showToast(`Precision: ${state.precision} digits`);
  });

  toggleAutoParen?.addEventListener("change", (e) => {
    state.autoParen = e.target.checked;
    showToast(`Auto-Parentheses: ${state.autoParen ? "ON" : "OFF"}`);
  });

  // Synchronize initial display state
  updateDisplay();

})();
