function Queue() {
    this.promise = Promise.resolve();
    return this;
}

Queue.prototype.push = function(fx) {
    this.promise = this.promise.then(() => {}).catch(() => {}).then(fx);
};

module.exports = Queue;
