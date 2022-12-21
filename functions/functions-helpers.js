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

const admin = require("firebase-admin");

/**
 * Writes a new score to the leaderboard.
 * @param {string} playerID The ID of the player associated with the score.
 * @param {number} score The score to be written.
 * @param {admin.firestore.Firestore} firestore The database storing
 *     the leaderboard.
 * @return {Promise<admin.firestore.WriteResult | Error>} Returns a promise
 *     that resolves when the write completes.
 */
async function createScore(playerID, score, firestore) {
  // Implement me
}

/**
 * Returns the rank and score of a player in the leaderboard.
 * @param {string} playerID The ID of the player associated with the score.
 * @param {admin.firestore.Firestore} firestore The database storing
 *     the leaderboard.
 * @return {Promise<Object<string, number>>} Returns a promise containing the
 *     player's rank and score.
 */
async function readRank(playerID, firestore) {
  // Implement me
}

/**
 * Updates the score of a player in the leaderboard.
 * @param {string} playerID The ID of the player associated with the score.
 * @param {number} newScore The player's new score.
 * @param {admin.firestore.Firestore} firestore The database storing
 *     the leaderboard.
 * @return {Promise<admin.firestore.WriteResult | Error>} Returns a promise
 *     that resolves when the write completes.
 */
async function updateScore(playerID, newScore, firestore) {
  // Implement me
}

module.exports = {createScore, readRank, updateScore};
