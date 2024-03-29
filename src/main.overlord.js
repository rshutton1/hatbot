/*
 * Copyright for Bob "Shibdib" Sardinia - See license file for more information,(c) 2023.
 */

const observers = require('module.observerController');
const factory = require('module.factoryController');
const defense = require('military.defense');
const links = require('module.linkController');
const terminals = require('module.terminalController');
const spawning = require('module.creepSpawning');
const state = require('module.roomState');
const planner = require('module.roomPlanner');
const diplomacy = require('module.diplomacy');

module.exports.overlordMind = function (room, CPULimit) {
    if (!room) return;

    let mindStart = Game.cpu.getUsed();

    // Manage creeps
    let count;
    let roomCreeps = shuffle(_.filter(Game.creeps, (r) => r.memory.overlord === room.name && !r.memory.military && !r.spawning));
    for (let creep of roomCreeps) {
        try {
            minionController(creep);
        } catch (e) {
            if (!errorCount[creep.name]) {
                errorCount[creep.name] = 1;
                log.e(creep.name + ' experienced an error in room ' + roomLink(creep.room.name));
                log.e(e);
                log.e(e.stack);
                Game.notify(e);
                Game.notify(e.stack);
            } else errorCount[creep.name] += 1;
            if (errorCount[creep.name] >= 50) {
                log.e(creep.name + ' experienced an error in room ' + roomLink(creep.room.name) + ' and has been killed.');
                creep.suicide();
            }
        }
    }

    // Room function loop
    let overlordFunctions = shuffle([{name: 'roomState', f: state.setRoomState},
        {name: 'links', f: links.linkControl},
        {name: 'terminals', f: terminals.terminalControl},
        {name: 'roomBuilder', f: planner.buildRoom},
        {name: 'observers', f: observers.observerControl},
        {name: 'factories', f: factory.factoryControl},
        {name: 'defense', f: defense.controller},
        {name: 'spawning', f: creepSpawning}]);
    let functionCount = overlordFunctions.length;
    count = 0;
    let overlordTaskTotalCPU = 0;
    do {
        let overlordTaskCurrentCPU = Game.cpu.getUsed();
        let currentFunction = _.first(overlordFunctions);
        if (!currentFunction) break;
        overlordFunctions = _.rest(overlordFunctions);
        count++;
        try {
            currentFunction.f(room);
        } catch (e) {
            log.e('Error with ' + currentFunction.name + ' function in room ' + roomLink(room.name));
            log.e(e);
            log.e(e.stack);
            Game.notify(e);
            Game.notify(e.stack);
            break;
        }
        overlordTaskCurrentCPU = Game.cpu.getUsed() - overlordTaskCurrentCPU;
        overlordTaskTotalCPU += overlordTaskCurrentCPU;
        //console.log(overlordTaskCurrentCPU + ' CPU used on ' + currentFunction.name + ' function')
    } while ((overlordTaskTotalCPU < CPULimit) && count < functionCount)

    // Store Data
    let used = Game.cpu.getUsed() - mindStart;
    let cpuUsageArray = ROOM_CPU_ARRAY[room.name] || [];
    if (cpuUsageArray.length < 100) {
        cpuUsageArray.push(used)
    } else {
        cpuUsageArray.shift();
        cpuUsageArray.push(used);
        if (average(cpuUsageArray) > CPULimit) {
            let cpuOverCount = room.memory.cpuOverage || 0;
            room.memory.cpuOverage = cpuOverCount + 1;
            log.e(room.name + ' is using a high amount of CPU - ' + average(cpuUsageArray));
            if (cpuOverCount >= 50) {
                room.memory.cpuOverage = undefined;
                room.memory.noRemote = Game.time + 5000;
                _.filter(Game.creeps, (c) => c.my && c.memory.overlord === room.name && c.room.name !== room.name && !c.memory.military).forEach((k) => k.suicide());
                //Game.notify(room.name + ' remote spawning has been disabled.');
                log.e(roomLink(room.name) + ' remote spawning has been disabled.');
            }
        } else {
            if (room.memory.cpuOverage) room.memory.cpuOverage--;
            if (room.memory.noRemote) {
                if (room.memory.noRemote <= Game.time) room.memory.noRemote = undefined;
                else room.memory.noRemote *= 0.9;
            }
        }
    }
    ROOM_CPU_ARRAY[room.name] = cpuUsageArray;
};

let errorCount = {};
function minionController(minion) {
    // Disable notifications
    if (!minion.memory.notifyDisabled) {
        minion.notifyWhenAttacked(false);
        minion.memory.notifyDisabled = true;
    }
    // Handle idle
    if (minion.idle) return;
    // Track Threat
    diplomacy.trackThreat(minion);
    // Combat
    minion.attackInRange();
    minion.healInRange();
    // Handle edge cases
    if (minion.borderCheck() || (minion.memory.fleeNukeTime && minion.fleeNukeRoom())) {
        return;
    }
    // Report intel chance
    if (!MY_ROOMS.includes(minion.room.name)) {
        minion.room.invaderCheck();
        minion.room.cacheRoomIntel(false, minion);
    }
    // Run role
    if (!minion.memory.role) return minion.suicide();
    require('role.' + minion.memory.role).role(minion);
}

function creepSpawning(room) {
    spawning.processBuildQueue(room);
    let spawnFunctions = [{name: 'essentialSpawning', f: spawning.essentialCreepQueue},
        {name: 'miscSpawning', f: spawning.miscCreepQueue},
        {name: 'remoteSpawning', f: spawning.remoteCreepQueue}];
    try {
        for (let task of spawnFunctions) {
            task.f(room);
        }
    } catch (e) {
        log.e(spawnFunctions[0].name + ' for room ' + room.name + ' experienced an error');
        log.e(e.stack);
        Game.notify(e.stack);
    }
}