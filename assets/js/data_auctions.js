function sum(arr) {
    return arr.reduce((a, b) => a + b, 0)
}

function clone(arr) {
    return JSON.parse(JSON.stringify(arr))
}

/**
 * Determines the total change in welfare across all agents if an agent receives the date.
 * @param {*} valuations         Array of valuations for each agent
 * @param {*} externality_matrix 2D array of externalities, where externality_matrix[i][j] is the externality of agent i on agent j
 * @returns                      An array of values W, where W[i] is the total change in welfare across all agents if agent i receives the data.
 */
function vcg_ws(valuations, externality_matrix) {
    var Ws = []
    for (var i = 0; i < valuations.length; i++) {
        const W = valuations[i] - externality_matrix[i].reduce((a, b) => a + b, 0) // valuation - sum of incoming externalities
        Ws.push(W)
    }
    return Ws
}
/**
 * Determines the price paid by agent i in the VCG auction were everyone knows
 * their own valuation and everyone else's externalities on them.
 * @param {Array} valuations     Array of valuations for each agent. Note that this is mutated
 * @param {*} externality_matrix 2D array of externalities, where externality_matrix[i][j] is the externality of agent i on agent j. Note that this is mutated
 * @param {*} i                  Index of agent i
 * @returns                      The price paid by agent i 
 */
function vcg_price(valuations, externality_matrix, i) {
    // Calculate welfare for everyone except i if i is present in the auction
    const present_allocation = vcg_ws(valuations, externality_matrix).map((x) => x >= 0 ? 1 : 0) // Set negative welfare to 0, since they aren't allocated
    var present_welfares = []
    for (var j = 0; j < valuations.length; j++) {
        // Calculate welfare for agent j
        const present_welfare_j = valuations[j] * present_allocation[j] - Array(5).fill(0).map((_, k) => externality_matrix[k][j] * present_allocation[k]).reduce((a, b) => a + b, 0)
        present_welfares.push(present_welfare_j)

    }
    const present_welfare = present_welfares.reduce((a, b) => a + b, 0) - present_welfares[i] // Sum welfare for everyone, subtract i's welfare

    // Create auction parameters if i is absent
    var absent_valuations = valuations
    absent_valuations.splice(i, 1)
    var absent_externality_matrix = externality_matrix
    absent_externality_matrix.splice(i, 1)
    for (var j = 0; j < absent_externality_matrix.length; j++) {
        absent_externality_matrix[j].splice(i, 1)
    }

    // Calculate welfare if i is absent from the auction
    const absent_ws = vcg_ws(absent_valuations, absent_externality_matrix).map((x) => x >= 0 ? x : 0) // Set negative welfare to 0, since they aren't allocated
    const absent_welfare = absent_ws.reduce((a, b) => a + b, 0) // Sum welfare for everyone when i is absent 

    // Return the externality imposed by i joining the auction.
    return absent_welfare - present_welfare
}

/**
 * Determines the allocation of data in the VCG auction were everyone knows
 * their own valuation and everyone else's externalities on them.
 * @param {*} valuations         Array of valuations for each agent
 * @param {*} externality_matrix 2D array of externalities, where externality_matrix[i][j] is the externality of agent i on agent j
 * @returns                      Array of 1s and 0s, where 1 indicates that agent i receives the data and 0 indicates that they do not.
 */
function vcg_allocation(valuations, externality_matrix) {
    const Ws = vcg_ws(valuations, externality_matrix)
    return Ws.map((x) => x >= 0 ? 1 : 0)
}


function sw_allocation(bids) {
    var Ws = []
    for (var i = 0; i < bids.length; i++) {
        var W = bids[i]["valuation"]
        for (j = 0; j < bids.length; j++) {
            if (i != j) {
                W -= bids[i]["incoming_externality_" + j]
            }
        }
        Ws.push(W)
    }

    var allocation = []
    for (var i = 0; i < bids.length; i++) {
        if (Ws[i] >= 0) {
            allocation.push(1)
        }
        else {
            allocation.push(0)
        }
    }

    return [Ws, allocation]
}

function shift_externalities(bid, i) {
    const new_bid = {
        "valuation": bid["valuation"],
    }
    var ext_index = 0
    for (var j = 0; j < 5; j++) {
        if (j != i) {
            new_bid["incoming_externality_" + ext_index] = bid["incoming_externality_" + j]
            ext_index += 1
        }
    }

    return new_bid
}

function sw_payment(bids, allocation, i) {
    console.log("Determining payment for agent " + i)
    var sw_absent = 0
    const absent_bids = bids.map((x) => shift_externalities(x, i))
    absent_bids.splice(i, 1)
    // console.log(absent_bids)
    const [absent_ws, absent_allocation] = sw_allocation(absent_bids)
    // console.log(absent_allocation)
    // console.log(absent_ws)
    // Sum social welfare for everyone else if i is absent from the auction
    for (var j = 0; j < 4; j++) {
        sw_absent += absent_ws[j]
    }

    // Social welfare for everyone except i
    var sw_present = 0
    for (var j = 0; j < 5; j++) {
        if (j != i) {
            // Social welfare for receiving the good
            sw_present += bids[j]["valuation"] * allocation[j]

            // Negative externalities from other agents
            for (var k = 0; k < 5; k++) {
                if (k != j) {
                    sw_present -= bids[j]["incoming_externality_" + k] * allocation[k]
                }
            }
        }
    }

    // console.log("sw_absent: " + sw_absent)
    // console.log("sw_present: " + sw_present)

    return sw_absent - sw_present
}

sw_profit = [0, 0, 0, 0, 0]
sw_count = 0
function sw_auction() {
    auction_name = "in-ext-sw"

    true_user_bid = {
        "valuation": 80,
        "incoming_externality_0": 0,
        "incoming_externality_1": 15,
        "incoming_externality_2": 10,
        "incoming_externality_3": 5,
        "incoming_externality_4": 5,
    }

    var bids = []

    user_bid = {}
    user_bid["valuation"] = parseFloat(document.getElementById(auction_name + "-user-bid").value)
    for (i = 1; i < 5; i++) {
        user_bid["incoming_externality_" + i] = parseFloat(document.getElementById(auction_name + "-user-ext-" + i).value)
    }
    user_bid["incoming_externality_0"] = 0
    for (const [key, value] of Object.entries(user_bid)) {
        if (Number.isNaN(value)) {
            document.getElementById(auction_name + "-failure").innerHTML = "Please enter valid numbers for all fields."
            return
        }
    }
    document.getElementById(auction_name + "-failure").innerHTML = ""


    bids.push(user_bid)

    for (i = 1; i <= 4; i++) {
        bid = {}
        bid["valuation"] = Math.random() * 40 + 60
        for (j = 1; j <= 4; j++) {
            if (i != j) {
                bid["incoming_externality_" + j] = Math.exp(Math.random() * Math.log(40)) + 5
            } else {
                bid["incoming_externality_" + j] = 0
            }
        }
        if (i <= 2) {
            bid["incoming_externality_0"] = Math.exp(Math.random() * Math.log(35)) + 5
        }
        else {
            bid["incoming_externality_0"] = Math.exp(Math.random() * Math.log(15)) + 5.0
        }
        bids.push(bid)
    }

    var valuations = []
    var externalities_matrix = []
    for (i = 0; i < 5; i++) {
        var row = []
        for (j = 0; j < 5; j++) {
            row.push(bids[j]["incoming_externality_" + i])
        }
        externalities_matrix.push(row)
        valuations.push(bids[i]["valuation"])
    }

    var Ws = []
    for (i = 0; i < 5; i++) {
        W = bids[i]["valuation"]
        for (j = 0; j < 5; j++) {
            if (i != j) {
                W -= bids[j]["incoming_externality_" + i]
            }
        }
        Ws.push(W)
    }

    var allocation = []
    for (i = 0; i < 5; i++) {
        if (Ws[i] >= 0) {
            allocation.push(1)
        }
        else {
            allocation.push(0)
        }
    }
    console.log("Allocation: " + allocation)

    var prices = []
    console.log("Valuations")
    console.log(valuations)
    console.log("Externalities")
    console.log(externalities_matrix)
    for (var i = 0; i < 5; i++) {
        prices.push(vcg_price(clone(valuations), clone(externalities_matrix), i))
    }

    console.log("Prices" + prices)

    bids[0] = true_user_bid
    var profits = []
    for (i = 0; i < 5; i++) {
        profits.push(bids[i]["valuation"] * allocation[i] - prices[i])
        for (j = 0; j < 5; j++) {
            profits[i] -= bids[i]["incoming_externality_" + j] * allocation[j]
        }
    }
    // profit = true_user_bid["valuation"] * allocation[0] - prices[0]
    // for (i = 1; i < 5; i++) {
    //     profit -= true_user_bid["incoming_externality_" + i] * allocation[i]
    // }
    // profits = [profit].concat(profits)

    console.log("Profit:" + profits[0])
    for (i = 0; i < 5; i++) {
        sw_profit[i] += profits[i]
    }
    sw_count += 1

    // Output everything
    for (var i = 0; i < 5; i++) {
        document.getElementById(auction_name + "-val-" + i).innerHTML = Math.round(bids[i]["valuation"] * 100) / 100.0
        document.getElementById(auction_name + "-alloc-" + i).innerHTML = allocation[i] == 1 ? "Yes" : "No"
        document.getElementById(auction_name + "-price-" + i).innerHTML = prices[i].toFixed(2)
        document.getElementById(auction_name + "-profit-" + i).innerHTML = profits[i].toFixed(2)
        if (i > 0) {
            document.getElementById(auction_name + "-ext-" + 0 + "-" + i).innerHTML = true_user_bid["incoming_externality_" + i].toFixed(2)
        }
        for (var j = 1; j < 5; j++) {
            if (i != j) {
                document.getElementById(auction_name + "-ext-" + j + "-" + i).innerHTML = bids[j]["incoming_externality_" + i].toFixed(2)
            }
        }
    }

    for (var i = 0; i < 5; i++) {
        if (allocation[i] > 0) {
            document.getElementById(auction_name + "-alloc-" + i).style.fontWeight = "bold"
        }
        else {
            document.getElementById(auction_name + "-alloc-" + i).style.fontWeight = "normal"
        }
        for (var j = 0; j < 5; j++) {
            if (allocation[j] > 0) {
                // Set to bold
                document.getElementById(auction_name + "-ext-" + i + "-" + j).style.fontWeight = "bold"
            }
            else {
                // Set to normal
                document.getElementById(auction_name + "-ext-" + i + "-" + j).style.fontWeight = "normal"
            }
        }
    }

    return profit
}

function sw_auction_repeated() {
    var profit = 0
    sw_profit = [0, 0, 0, 0, 0]
    sw_count = 0
    for (index = 0; index < 1000; index++) {
        profit += sw_auction()
        console.log("Ran iteration " + index)
    }
    console.log(profit / 1000)
}

