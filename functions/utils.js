/**
 * Copyright 2022 Google LLC. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
"use strict";

let currentUserID = 0;

// Using a monotonically increasing value for simplicity.
// This makes fetching users to modify their scores later
// easier, which is not a problem you will run into in a
// real game.
/**
 * Generates a new user ID.
 * @return {number} Returns a monotonically increasing integer.
 */
function newUserID() {
  const value = currentUserID;
  currentUserID++;
  return value;
}

// Arbitrarily decided score. Will have a roughly uniform distribution,
// though in real games scores will almost never be evenly distributed.
/**
 * Generates a random score.
 * @return {number} A score between 0 and 1000, including decimals.
 */
function randomScore() {
  return Math.random() * 1000;
}

module.exports = {newUserID, randomScore};
