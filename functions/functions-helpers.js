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
  /**
   * This function assumes a minimum score of 0 and that value
   * is between min and max.
   * Returns the expected size of a bucket for a given score
   * so that bucket sizes stay constant, to avoid expensive
   * re-bucketing.
   * @param {number} value The new score.
   * @param {number} min The min of the previous range.
   * @param {number} max The max of the previous range. Must be greater than
   *     min.
   * @return {Object<string, number>} Returns an object containing the new min
   *     and max.
   */
  function bucket(value, min, max) {
    const bucketSize = (max - min) / 3;
    const bucketMin = Math.floor(value / bucketSize) * bucketSize;
    const bucketMax = bucketMin + bucketSize;
    return {min: bucketMin, max: bucketMax};
  }

  /**
   * A function used to store pending writes until all reads within a
   * transaction have completed.
   *
   * @callback PendingWrite
   * @param {admin.firestore.Transaction} transaction The transaction
   *     to be used for writes.
   * @returns {void}
   */

  /**
   * Recursively searches for the node to write the score to,
   * then writes the score and updates any counters along the way.
   * @param {number} id The user associated with the score.
   * @param {number} value The new score.
   * @param {admin.firestore.CollectionReference} coll The collection this
   *     value should be written to.
   * @param {Object<string, number>} range An object with properties min and
   *     max defining the range this score should be in. Ranges cannot overlap
   *     without causing problems. Use the bucket function above to determine a
   *     root range from constant values to ensure consistency.
   * @param {admin.firestore.Transaction} transaction The transaction used to
   *     ensure consistency during tree updates.
   * @param {Array<PendingWrite>} pendingWrites A series of writes that should
   *     occur once all reads within a transaction have completed.
   * @return {void} Write error/success is handled via the transaction object.
   */
  async function writeScoreToCollection(
      id, value, coll, range, transaction, pendingWrites) {
    const snapshot = await transaction.get(coll);
    if (snapshot.empty) {
      // This is the first score to be inserted into this node.
      for (const write of pendingWrites) {
        write(transaction);
      }
      const docRef = coll.doc();
      transaction.create(docRef, {exact: {score: value, user: id}});
      return;
    }

    const min = range.min;
    const max = range.max;

    for (const node of snapshot.docs) {
      const data = node.data();
      if (data.exact !== undefined) {
        // This node held an exact score.
        const newRange = bucket(value, min, max);
        const tempRange = bucket(data.exact.score, min, max);

        if (newRange.min === tempRange.min &&
          newRange.max === tempRange.max) {
          // The scores belong in the same range, so we need to "demote" both
          // to a lower level of the tree and convert this node to a range.
          const rangeData = {
            range: newRange,
            count: 2,
          };
          for (const write of pendingWrites) {
            write(transaction);
          }
          const docReference = node.ref;
          transaction.set(docReference, rangeData);
          transaction.create(docReference.collection("scores").doc(), data);
          transaction.create(
              docReference.collection("scores").doc(),
              {exact: {score: value, user: id}},
          );
          return;
        } else {
          // The scores are in different ranges. Continue and try to find a
          // range that fits this score.
          continue;
        }
      }

      if (data.range.min <= value && data.range.max > value) {
        // The score belongs to this range that may have subvalues.
        // Increment the range's count in pendingWrites, since
        // subsequent recursion may incur more reads.
        const docReference = node.ref;
        const newCount = node.get("count") + 1;
        pendingWrites.push((t) => {
          t.update(docReference, {count: newCount});
        });
        const newRange = bucket(value, min, max);
        return writeScoreToCollection(
            id,
            value,
            docReference.collection("scores"),
            newRange,
            transaction,
            pendingWrites,
        );
      }
    }

    // No appropriate range was found, create an `exact` value.
    transaction.create(coll.doc(), {exact: {score: value, user: id}});
  }

  const scores = firestore.collection("scores");
  const players = firestore.collection("players");
  return firestore.runTransaction((transaction) => {
    return writeScoreToCollection(
        playerID, score, scores, {min: 0, max: 1000}, transaction, [],
    ).then(() => {
      transaction.create(players.doc(), {
        user: playerID,
        score: score,
      });
    });
  });
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
  const players = await firestore.collection("players")
      .where("user", "==", playerID).get();
  if (players.empty) {
    throw Error(`Player not found in leaderboard: ${playerID}`);
  }
  if (players.size > 1) {
    console.info(`Multiple scores with player ${playerID}, fetching first`);
  }
  const player = players.docs[0].data();
  const score = player.score;

  const scores = firestore.collection("scores");

  /**
   * Recursively finds a player score in a collection.
   * @param {string} id The player's ID, since some players may be tied.
   * @param {number} value The player's score.
   * @param {admin.firestore.CollectionReference} coll The collection to
   *     search.
   * @param {number} currentCount The current count of players ahead of the
   *     player.
   * @return {Promise<number>} The rank of the player (the number of players
   *     ahead of them plus one).
   */
  async function findPlayerScoreInCollection(id, value, coll, currentCount) {
    const snapshot = await coll.get();
    for (const doc of snapshot.docs) {
      if (doc.get("exact") !== undefined) {
        // This is an exact score. If it matches the score we're looking
        // for, return. Otherwise, check if it should be counted.
        const exact = doc.data().exact;
        if (exact.score === value) {
          if (exact.user === id) {
            // Score found.
            return currentCount + 1;
          } else {
            // The player is tied with another. In this case, don't increment
            // the count.
            continue;
          }
        } else if (exact.score > value) {
          // Increment count
          currentCount++;
          continue;
        } else {
          // Do nothing
          continue;
        }
      } else {
        // This is a range. If it matches the score we're looking for,
        // search the range recursively, otherwise, check if it should be
        // counted.
        const range = doc.data().range;
        const count = doc.get("count");
        if (range.min > value) {
          // The range is greater than the score, so add it to the rank
          // count.
          currentCount += count;
          continue;
        } else if (range.max <= value) {
          // do nothing
          continue;
        } else {
          const subcollection = doc.ref.collection("scores");
          return findPlayerScoreInCollection(
              id,
              value,
              subcollection,
              currentCount,
          );
        }
      }
    }
    // There was no range containing the score.
    throw Error(`Range not found for score: ${value}`);
  }

  const rank = await findPlayerScoreInCollection(playerID, score, scores, 0);
  return {
    user: playerID,
    rank: rank,
    score: score,
  };
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
