// Basic Instance class for item instances
class Instance {
    constructor({ path }) {
        this.path = path // Path to the instance file (e.g., VMF)
    }

    // Placeholder: In the future, this would parse the VMF and return all entities
    getAllEntities() {
        // TODO: Implement VMF parsing and entity extraction
        return []
    }
}

module.exports = { Instance }
