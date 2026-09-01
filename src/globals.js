// CDN Global → npm Import bridge (DailyTask pattern, verbatim reuse).
//
// legacy/app.js references React, ReactDOM, firebase as bare globals
// (exactly as CDN <script> tags used to provide them). This file's only
// job is to import those libraries via npm and attach them to `window`
// so app.js can run with plain global references — usage pattern
// unchanged from the proven DailyTask app.
//
// Import ORDER matters (side-effect compat modules extend the same
// `firebase` default export), and this file's own execution must finish
// BEFORE legacy/app.js runs — guaranteed by main.jsx's import order.
//
// নোট: chart.js এখানে ইচ্ছাকৃতভাবে বাদ (Process Rule ৮ — অপ্রয়োজনীয়
// bundle-growth এড়ানো)। Trend Chart (Architecture Plan §7.1) ফিচার
// implement হওয়ার সময় (P5/P7) এখানে যোগ হবে।

import React from "react";
import ReactDOM from "react-dom/client";

import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import "firebase/compat/auth";
import "firebase/compat/app-check";

window.React = React;
window.ReactDOM = ReactDOM;
window.firebase = firebase;
