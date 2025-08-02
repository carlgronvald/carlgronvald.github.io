function second_price_ipv() {
    var valuations = []
    for (i = 1; i <= 8; i++) {
        valuations.push(Math.random() * 150);
        document.getElementById("spa-op-" + i).innerHTML = valuations[i - 1].toFixed(2) + "€";
    }
    var user_valuation = document.getElementById("spa-user-bid").value;

    var max_valuation = Math.max(...valuations);
    var second_max_valuation = Math.max(...valuations.filter(valuation => valuation != max_valuation));
    output_element = document.getElementById("spa-output");
    profit = 0
    if (user_valuation > max_valuation) {
        output_element.innerHTML = "You win the aucion! You paid " + second_max_valuation.toFixed(2) + "€, giving you a profit of " + (120 - second_max_valuation).toFixed(2) + "€.";
        profit = 120 - second_max_valuation
    }
    else {
        second_max_valuation = Math.max(second_max_valuation, user_valuation)
        output_element.innerHTML = "You lost the auction. The winner paid " + second_max_valuation.toFixed(2) + "€, giving them a profit of " + (max_valuation - second_max_valuation).toFixed(2) + "€.";
    }
    avg_profit = parseFloat(document.getElementById("spa-output-avg-profit").textContent);
    total_trades = parseInt(document.getElementById("spa-output-total-trades").textContent);
    if (isNaN(avg_profit)) {
        avg_profit = profit;
        total_trades = 1
    }
    else {
        avg_profit = (avg_profit * total_trades + profit) / (total_trades + 1);
        total_trades += 1;
    }
    document.getElementById("spa-output-avg-profit").textContent = "" + avg_profit.toFixed(4);
    document.getElementById("spa-output-total-trades").textContent = "" + total_trades;
}


let spiv_data = {}
function sp_dependent_valuation() {
    state = document.getElementById("spadv-button").value
    if (state == "Start Auction") {
        start_spdv()
    } else {
        run_spdv()
    }
}

// Standard Normal variate using Box-Muller transform.
function gaussianRandom(mean = 0, stdev = 1) {
    const u = 1 - Math.random(); // Converting [0,1) to (0,1]
    const v = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    // Transform to the desired mean and standard deviation:
    return z * stdev + mean;
}

function erf(upper_lim) {
    var z = (upper_lim) / Math.sqrt(2);
    var t = 1 / (1 + 0.3275911 * Math.abs(z));
    var a1 = 0.254829592;
    var a2 = -0.284496736;
    var a3 = 1.421413741;
    var a4 = -1.453152027;
    var a5 = 1.061405429;
    var erf = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
    return erf;
}


//wolframalpha.com
function expected_val_less_than(upper_lim, mu, sigma) {
    first_term = 1 / 2 * mu * erf((upper_lim - mu) / (Math.sqrt(2) * sigma))
    // console.log("term 1 " + first_term)  
    // erf(infty) = 1
    second_term = 1 / 2 * mu * 1
    // console.log("term 2 " + second_term)
    // exp^(-infty) = 0
    third_term = - sigma * (Math.exp(-((mu - upper_lim) ** 2 / (2 * (sigma ** 2))))) / (Math.sqrt(2 * Math.PI))
    // console.log("term 3 " + third_term)
    // erf(infty) = 1 again
    probability_factor = 1 / 2 * (erf((upper_lim - mu) / (Math.sqrt(2) * sigma)) + 1)
    // console.log("prob factor " + probability_factor)
    return (first_term + second_term + third_term) / probability_factor
}


function get_valuation(shared_signal) {
    const true_signal = shared_signal
    const prior_valuation = true_signal + gaussianRandom(0, 5)
    return {
        true_signal: true_signal,
        prior_valuation: prior_valuation
    }
}


function joint_expectation(EX, pdf_X, EY, pdf_Y, min, max, steps) {
    total = 0
    for (i = 0; i < steps; i++) {
        for (j = 0; j < steps; j++) {
            min_val_x = min + (max - min) * i / steps
            min_val_y = min + (max - min) * j / steps

            value = (min_val_x) * (min_val_y) * ((max - min) ** 2 / (steps ** 2)) * pdf_X(min_val_x) * pdf_Y(min_val_y)
            total += value
        }
    }
    console.log("Joint Expectation: " + total)
    return total
}

function covariance(EX, pdf_X, EY, pdf_Y, min, max, steps) {
    return joint_expectation(EX, pdf_X, EY, pdf_Y, min, max, steps) - EX * EY
}

function variance(EX, pdf_X, min, max, steps) {
    total = 0
    for (i = 0; i < steps; i++) {
        min_val = min + (max - min) * i / steps
        value = (min_val - EX) ** 2 * ((max - min) / steps) * pdf_X(min_val)
        total += value
    }
    console.log("variance: " + total)
    return total
}

function E_given(EX, pdf_X, Y, EY, pdf_Y, min, max, steps) {
    return EX + covariance(EX, pdf_X, EY, pdf_Y, min, max, steps) / variance(EY, pdf_Y, min, max, steps) * (Y - EY)
}

function normal_pdf(mean, stdev) {
    return function (x) {
        return Math.exp(-((x - mean) ** 2) / (2 * (stdev ** 2))) / (Math.sqrt(2 * Math.PI) * stdev)
    }
}


function start_spdv() {
    spiv_data["spiv_valuation"] = gaussianRandom(100, 20)
    const valuation = get_valuation(spiv_data["spiv_valuation"])
    spiv_data["valuation"] = valuation

    document.getElementById("spadv-your-pri-valuation").textContent = "Your prior valuation: " + spiv_data["valuation"]["prior_valuation"].toFixed(2)
    document.getElementById("spadv-user-bid").value = spiv_data["valuation"]["prior_valuation"].toFixed(2)
    document.getElementById("spadv-your-post-valuation").textContent = "The true valuation: ..."
    // Clear competitors' prior valuations
    for (i = 1; i <= 8; i++) {
        const valuation = get_valuation(spiv_data["spiv_valuation"])
        spiv_data["valuation_" + i] = valuation
        document.getElementById("spadv-op-" + i).innerHTML = "...";
    }
    document.getElementById("spadv-button").value = "Run Auction"
}

function expected_V_from_prior_2(pdf_X, y, pdf_eps, min, max, steps) {
    total = 0
    normalizer = 0
    for (i = 0; i < steps; i++) {
        min_val = min + (max - min) * i / steps
        value = (min_val) * pdf_X(min_val) * pdf_eps(y - min_val) * ((max - min) / steps)
        normalizer += pdf_X(min_val) * pdf_eps(y - min_val) * ((max - min) / steps)
        total += value
    }
    return total / normalizer
}

function expected_val_less_than(pdf_sj, min, max, steps) {
    total = 0
    normalizer = 0
    for (i = 0; i < steps; i++) {
        min_val = min + (max - min) * i / steps
        value = (min_val) * pdf_sj(min_val) * ((max - min) / steps)
        normalizer += pdf_sj(min_val) * ((max - min) / steps)
        total += value
    }
    return total / normalizer
}

function run_spdv() {
    var bids = []
    // Write out competitors' prior valuations
    // TODO: WRITE OUT POSTERIOR TOO?
    for (j = 1; j <= 8; j++) {
        const valuation = spiv_data["valuation_" + j]
        document.getElementById("spadv-op-" + j).innerHTML = valuation["prior_valuation"].toFixed(2);
        // expected_V_from_prior = expected_V_from_prior_2(normal_pdf(100, 20), valuation["prior_valuation"], normal_pdf(0, 5), -300, 300, 1000)
        // console.log(expected_V_from_prior)

        // expvlt = expected_val_less_than(valuation["prior_valuation"], expected_V_from_prior, Math.sqrt(20 ** 2 + 5 ** 2))
        // expected_V = expected_V_from_prior
        // console.log("exp V" + expected_V)
        // for (k = 1; k <= 7; k++) {
        // expected_V = expected_val_less_than(normal_pdf(expected_V, Math.sqrt(5 ** 2)), -500, valuation["prior_valuation"], 1000)

        // }
        // console.log("expvlt" + expected_V)
        // console.log("expected_val_less_than: " + expvlt)
        // best_bid = 1 / 9 * (expected_V * 8 + valuation["prior_valuation"])
        // console.log("best bid: " + expected_V)
        bids.push(valuation["prior_valuation"])
    }
    // TODO: CALCULATE POSTERIOR VALUATION??
    document.getElementById("spadv-your-post-valuation").textContent = "Your true valuation: " + spiv_data["valuation"]["true_signal"].toFixed(2)

    // Run second price auction
    user_bid = document.getElementById("spadv-user-bid").value
    bids.push(parseFloat(user_bid))
    const auction_result = second_price(bids)
    const winner = auction_result["winner"]
    var price_paid = auction_result["price_paid"]

    // Write out auction result 
    if (winner == 8) { // You won!
        profit = spiv_data["valuation"]["true_signal"] - price_paid
        document.getElementById("spadv-output").innerHTML = "You won the auction! You paid " + price_paid.toFixed(2) + "€, giving you a profit of " + profit.toFixed(2) + "€.";
    }
    else { // You lost
        document.getElementById("spadv-output").innerHTML = "You lost the auction. The winner paid " + price_paid.toFixed(2) + "€, giving them a profit of " + (spiv_data["valuation_" + (winner + 1)]["true_signal"] - price_paid).toFixed(2) + "€.";
    }

    document.getElementById("spadv-button").value = "Start Auction"


    avg_profit = parseFloat(document.getElementById("spadv-output-avg-profit").textContent);
    total_trades = parseInt(document.getElementById("spadv-output-total-trades").textContent);
    if (isNaN(avg_profit)) {
        avg_profit = profit;
        total_trades = 1
    }
    else {
        avg_profit = (avg_profit * total_trades + profit) / (total_trades + 1);
        total_trades += 1;
    }
    document.getElementById("spadv-output-avg-profit").textContent = "" + avg_profit.toFixed(4);
    document.getElementById("spadv-output-total-trades").textContent = "" + total_trades;

}



function max_and_second(list) {
    let max = -Infinity
    let second_max = -Infinity

    for (const number of list) {
        if (number > max) {
            [second_max, max] = [max, number]
        }
        else if (number < max && number > second_max) {
            second_max = number
        }
    }
    return [max, second_max]
}

// // Function for running the second price auctton, given a list of bids
function second_price(bids) {
    // Find highest and second highest bids
    const [max_bid, second_max_bid] = max_and_second(bids)
    const winner = bids.indexOf(max_bid);
    // Return index of highest bid as auction winner, second highest bid as price paid
    return {
        winner: winner,
        price_paid: second_max_bid
    }
}