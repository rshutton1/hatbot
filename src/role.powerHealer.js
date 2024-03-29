/*
 * Copyright for Bob "Shibdib" Sardinia - See license file for more information,(c) 2023.
 */

module.exports.role = function (creep) {
    if (!Memory.auxiliaryTargets[creep.memory.destination]) creep.suicide();
    //Initial move
    if (creep.pos.roomName !== creep.memory.destination) {
        creep.shibMove(new RoomPosition(25, 25, creep.memory.destination), {range: 23});
    } else {
        let powerBank = _.filter(creep.room.impassibleStructures, (s) => s.structureType === STRUCTURE_POWER_BANK)[0];
        if (powerBank && creep.pos.isNearTo(powerBank)) creep.moveRandom();
        if (creep.memory.assigned) {
            let assignment = Game.getObjectById(creep.memory.assigned);
            if (!assignment) return creep.memory.assigned = undefined;
            switch (creep.heal(assignment)) {
                case ERR_NOT_IN_RANGE:
                    creep.shibMove(assignment, {ignoreCreeps: false});
                    creep.rangedHeal(assignment);
            }
        } else {
            let attacker = _.filter(creep.room.myCreeps, (c) => c.memory.role === 'powerAttacker' && !_.filter(creep.room.creeps, (h) => h.my && h.memory.assigned === c.id)[0])[0];
            if (attacker) creep.memory.assigned = attacker.id; else {
                if (creep.pos.getRangeTo(powerBank) > 2) creep.shibMove(powerBank, {range: 2});
                creep.healInRange();
            }
        }
    }
};