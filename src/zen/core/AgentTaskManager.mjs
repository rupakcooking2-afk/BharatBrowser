/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class nsAgentTaskManager {
  _tasks = [];
  _taskIdCounter = 0;

  get tasks() {
    return this._tasks;
  }

  get runningTasks() {
    return this._tasks.filter(t => t.status === "running");
  }

  get queuedTasks() {
    return this._tasks.filter(t => t.status === "queued");
  }

  get completedTasks() {
    return this._tasks.filter(t => t.status === "completed");
  }

  get failedTasks() {
    return this._tasks.filter(t => t.status === "failed");
  }

  createTask(goal) {
    const task = {
      taskId: `agent-${++this._taskIdCounter}-${Date.now()}`,
      goal,
      status: "queued",
      createdAt: Date.now(),
      completedAt: null,
      steps: [],
      summary: "",
    };
    this._tasks.unshift(task);
    return task;
  }

  updateTask(taskId, updates) {
    const task = this._tasks.find(t => t.taskId === taskId);
    if (task) Object.assign(task, updates);
    return task;
  }

  markRunning(taskId) {
    return this.updateTask(taskId, { status: "running" });
  }

  markCompleted(taskId, summary) {
    return this.updateTask(taskId, { status: "completed", completedAt: Date.now(), summary });
  }

  markFailed(taskId, error) {
    return this.updateTask(taskId, { status: "failed", completedAt: Date.now(), summary: error });
  }

  addStep(taskId, step) {
    const task = this._tasks.find(t => t.taskId === taskId);
    if (task) task.steps.push({ ...step, timestamp: Date.now() });
    return task;
  }

  updateStep(taskId, stepIndex, updates) {
    const task = this._tasks.find(t => t.taskId === taskId);
    if (task && task.steps[stepIndex]) {
      Object.assign(task.steps[stepIndex], updates);
    }
    return task;
  }

  removeTask(taskId) {
    this._tasks = this._tasks.filter(t => t.taskId !== taskId);
  }

  getTask(taskId) {
    return this._tasks.find(t => t.taskId === taskId);
  }

  clearCompleted() {
    this._tasks = this._tasks.filter(t => t.status === "running" || t.status === "queued");
  }
}

window.gAgentTaskManager = new nsAgentTaskManager();
