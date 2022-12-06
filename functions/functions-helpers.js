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
  return firestore.collection("scores").doc().create({
    user: playerID,
    score: score,
  });
}

/**
 * Returns the rank and score of a player in the leaderboard.
 * @param {string} playerID The ID of the player associated with the score.
 * @param {admin.firestore.Firestore} firestore The database storing
 *     the leaderboard.
 * @return {Promise<any>} Returns a promise containing the player's rank
 *     and score.
 */
async function readRank(playerID, firestore) {
  const scores = await firestore.collection("scores")
      .orderBy("score", "desc").get();
  const player = `${playerID}`;
  let rank = 1;
  for (const doc of scores.docs) {
    const user = `${doc.get("user")}`;
    if (user === player) {
      return {
        user: player,
        rank: rank,
        score: doc.get("score"),
      };
    }
    rank++;
  }
  // No user found
  throw Error(`User not found in leaderboard: ${playerID}`);
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
  const scores = firestore.collection("scores");
  const playerSnapshot = await scores
      .where("user", "==", playerID).get();
  if (playerSnapshot.size === 0) {
    throw Error(`User not found in leaderboard: ${playerID}`);
  }
  const player = playerSnapshot.docs[0];
  const doc = scores.doc(player.id);
  return doc.update({
    user: playerID,
    score: newScore,
  });
}

module.exports = {createScore, readRank, updateScore};
