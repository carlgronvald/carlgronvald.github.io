// const { math } = require("./math")


function multiply_by_epsilon(x) {
    return x * 0.00001
}

function update(y, augmented_x, beta, M, memory_factor) {

    const residual = y - math.multiply(beta, augmented_x).subset(math.index(0, 0))
    M = math.add(math.multiply(M, memory_factor), math.multiply(augmented_x, math.transpose(augmented_x)))

    const M_size = math.size(M)

    var delta_beta = math.inv(M)//math.add(M, math.map(math.identity(M_size), multiply_by_epsilon)))
    delta_beta = math.multiply(delta_beta, augmented_x)
    delta_beta = math.multiply(delta_beta, residual)
    beta = math.add(beta, math.transpose(delta_beta))

    return [beta, M]
}

//
// console.log(update(1, [[1], [2], [3]], [1, 2, 3], [[1, 2, 3], [4, 5, 6], [7, 8, 9]], 0.5))
// Gives [1.48,1.04,0.59], [[1.5,3.,4.5],[4,6.5,9],[6.5,10,13.5]]

function run_regression(augmented_x, y, init_size, memory_factor) {
    const x_init = augmented_x.slice(0, init_size)
    const y_init = y.slice(0, init_size)
    var M = math.multiply(math.transpose(x_init), x_init)
    M = math.add(M, math.map(math.identity(math.size(M)), multiply_by_epsilon))
    var used_mem_factor = 0
    for (var t = 0; t < init_size; t++) {
        used_mem_factor += memory_factor ** t
    }
    const mem_factor = (1 / (1 - memory_factor)) / used_mem_factor
    M = math.map(M, x => x * mem_factor)

    var beta = math.multiply(math.inv(M), math.multiply(math.multiply(math.transpose(x_init), y_init), mem_factor))
    beta = math.matrix(beta).reshape([1, math.size(augmented_x)[1]])

    init_preds = math.flatten(math.multiply(x_init, math.transpose(beta)))
    init_comparison = math.subtract(y_init, init_preds)
    init_losses = math.map(init_comparison, x => x ** 2)
    var init_loss = 0
    for (var t = 0; t < init_losses.size()[0]; t++) {
        init_loss += (1 - memory_factor) * init_losses.get([t]) * (memory_factor ** (init_losses.size()[0] - t - 1))
    }
    init_loss = init_loss * mem_factor

    var predictions = []

    for (var i = init_size; i < augmented_x.length; i++) {
        augmented_x_t = math.matrix(augmented_x[i].slice(0))

        predictions.push(math.multiply(beta, augmented_x_t))
        out_list = update(y[i], augmented_x_t.reshape([-1, 1]), beta, M, memory_factor)
        beta = out_list[0]
        M = out_list[1]
    }
    return {
        "predictions": predictions,
        "beta": beta,
        "M": M,
        "init_loss": init_loss,
    }
}


function features_to_index(set) {
    index = 0
    for (var element of set) {
        index += 2 ** element
    }
    return index
}

function index_to_features(index) {
    var features = []
    while (index > 0) {
        const feature = Math.floor(math.log2(index))
        features.push(feature)
        index -= 2 ** feature
    }
    return features
}
// Predictions are almost correct
// predictions = run_regression([[1, 2, 3], [1, 4, 5], [1, 6, 7], [1, 8, 9], [1, 10, 11], [1, 12, 13], [1, 14, 15]], [1, 2, 3, 4, 5, 6, 7], 2, 0.99)
// console.log(predictions)
function run_regressions(augmented_x, y, init_size, memory_factor) {
    var regressions = [0]
    for (var i = 1; i < 2 ** math.size(augmented_x)[1]; i++) {
        const features = index_to_features(i)

        const regression_features = math.subset(augmented_x, math.index(math.range(0, augmented_x.length), features))
        var new_regression = run_regression(math.subset(augmented_x, math.index(math.range(0, augmented_x.length), features)), y, init_size, memory_factor)
        new_regression["features"] = features
        regressions.push(new_regression)
    }
    return regressions
}

function calculate_loss_estimate(init_loss, y, predictions, memory_factor) {
    var loss_estimate = init_loss
    var loss_estimates = math.zeros([y.length])

    for (var t = 0; t < y.length; t++) {
        const loss = (y[t] - predictions[t].get([0])) ** 2

        loss_estimate = memory_factor * loss_estimate + (1 - memory_factor) * loss


        loss_estimates[t] = loss_estimate
    }
    return loss_estimates
}

function calculate_loss_estimates(init_loss, y, regressions, memory_factor, init_size) {
    var loss_estimates = [0]
    index = math.index(math.range(init_size, y.length))
    subset_y = math.subset(y, math.index(math.range(init_size, y.length)))
    for (var i = 1; i < regressions.length; i++) {
        loss_estimates.push(calculate_loss_estimate(regressions[i]["init_loss"], subset_y, regressions[i]["predictions"], memory_factor))
    }
    return loss_estimates
}

function shapley(loss_estimates, feature, central_features) {
    var shapley_base_sets = []
    for (var i = 1; i < loss_estimates.length; i++) {
        features = index_to_features(i)
        if (!central_features.every(feature => features.includes(feature))) {
            continue
        }
        if (!features.includes(feature)) {
            shapley_base_sets.push(features)
        }
    }

    var shapley = math.zeros([loss_estimates[1].length])

    for (var base_set of shapley_base_sets) {
        base_losses = math.map(loss_estimates[features_to_index(base_set)], math.sqrt)
        next_set = base_set.concat([feature])
        next_losses = math.map(loss_estimates[features_to_index(next_set)], math.sqrt)
        contrib = math.subtract(base_losses, next_losses)
        shapley = math.add(shapley, contrib)
    }
    shapley = math.multiply(shapley, 1 / shapley_base_sets.length)

    return shapley

}

function calculate_payments(
    loss_estimates,
    central_features,
    payment_willingness
) {
    var payments = []
    for (var i = 0; i < math.floor(math.log2(loss_estimates.length)); i++) {
        payment = shapley(loss_estimates, i, central_features)
        payment = math.multiply(payment, payment_willingness)
        payments.push(payment)
    }
    return payments
}

function gaussianRandom(mean = 0, stdev = 1) {
    const u = 1 - Math.random(); // Converting [0,1) to (0,1]
    const v = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    // Transform to the desired mean and standard deviation:
    return z * stdev + mean;
}


const N = 395
const base_data = math.zeros([N, 4])
var T = 10
const init_size = 30
var coefs = math.zeros([N, 4])
var y = math.zeros([N])
for (var i = 0; i < N; i++) {
    base_data[i][0] = 1
    base_data[i][1] = gaussianRandom()
    if (base_data[i][1] < 0) {
        base_data[i][1] = 0
    }
    base_data[i][2] = gaussianRandom()
    base_data[i][3] = gaussianRandom()
    if (base_data[i][3] < -2) {
        base_data[i][3] = -2
    }
    coefs[i][1] = -3 + math.cos(i / 100 * 6.28)
    coefs[i][2] = -4 + math.sin(i / 100 * 6.28)
    coefs[i][3] = 2 + math.cos(i / 40 * 6.28)
    y[i] = math.multiply(base_data[i], coefs[i]) * 100 + 500
    base_data[i][1] = base_data[i][1] * 2
    base_data[i][2] = base_data[i][2] * 2 + 4
    base_data[i][3] = base_data[i][3] * 5 + 15
}

function simple_market(features_available, T) {
    if (T + init_size >= N) {
        return "Not enough data"
    }
    const payment_willingness = 1
    const memory_factor = 0.95
    var used_data = base_data
    var used_y = y

    used_data = math.subset(used_data, math.index(math.range(0, T + init_size), features_available))
    used_y = math.subset(y, math.index(math.range(0, T + init_size)))

    const init_data = math.subset(used_data, math.index(math.range(0, init_size), math.range(0, 4)))
    const init_y = math.subset(used_y, math.index(math.range(0, init_size)))
    M = math.multiply(math.transpose(init_data), init_data)
    const rhs = math.multiply(math.transpose(init_data), init_y)
    var beta = math.multiply(math.inv(M), rhs)

    beta = math.matrix(beta).reshape([1, math.size(used_data)[1]])
    const preds = math.flatten(math.multiply(init_data, math.transpose(beta)))
    const init_comparison = math.subtract(init_y, preds)
    const init_losses = math.map(init_comparison, x => x ** 2)
    var init_loss = 0
    const total_mem_factor = 1 / (1 - memory_factor)
    var used_mem_factor = 0.0
    for (var t = 0; t < init_losses.size()[0]; t++) {
        used_mem_factor += memory_factor ** (init_losses.size()[0] - t - 1)
        init_loss += init_losses.get([t]) * (memory_factor ** (init_losses.size()[0] - t - 1))
    }
    const mem_scaling = total_mem_factor / used_mem_factor
    console.log("mem_scaling:", mem_scaling)

    init_loss = init_loss * mem_scaling
    M = math.map(M, x => x * mem_scaling)


    const central_features = [0]
    const regressions = run_regressions(used_data, used_y, init_size, memory_factor)
    const loss_estimates = calculate_loss_estimates(init_loss, used_y, regressions, memory_factor, init_size)

    const shapley_values = [0, 1, 2, 3].map(feature => shapley(loss_estimates, feature, central_features))
    var payments = calculate_payments(loss_estimates, central_features, payment_willingness)
    payments = math.map(payments, x => math.max(x, 0));
    return [regressions[regressions.length - 1], payments, regressions[1], y, shapley_values]
}

function fmt(x, n = 2) {
    precision_multiply = 10 ** n
    return Math.round(x * precision_multiply) / precision_multiply
}
var total_net_savings = 0
function time_step() {

    console.log("T", T)
    if (T >= N - init_size) {

        const date_elem = document.getElementById("date")
        date_elem.textContent = "Day #" + (T - 9) + "(last day)"
        return
    }
    const out_list = simple_market([0, 1, 2, 3], T)
    const grand_regression = out_list[0]
    const payments = out_list[1]
    console.log("Grand regression", grand_regression)

    const beta = grand_regression["beta"]
    const M = grand_regression["M"]
    const predictions = grand_regression["predictions"]
    const central_agent_predictions = out_list[2]["predictions"]
    const y = out_list[3]
    const shapley_values = out_list[4]

    console.log("beta", beta)
    console.log("M", M)
    console.log("predictions", predictions)
    console.log("central_agent_predictions", central_agent_predictions)
    console.log("y", y)
    console.log("shapley_values", shapley_values)

    len = shapley_values[0].length
    total_shapley = shapley_values[1][len - 1] + shapley_values[2][len - 1] + shapley_values[3][len - 1]
    total_payment = payments[1][len - 1] + payments[2][len - 1] + payments[3][len - 1]

    for (var i = 1; i <= 4; i++) {
        for (var j = 1; j <= 4; j++) {
            const elem = document.getElementById("M-" + i + "-" + j)

            elem.textContent = fmt(M.get([i - 1, j - 1]))
        }
        const coef_elem = document.getElementById("coef" + i)
        coef_elem.textContent = fmt(beta.get([0, 3 - (i - 1)]))

        const shapley_elem = document.getElementById("shapley" + i)
        shapley_elem.textContent = fmt(shapley_values[i - 1][len - 1] / total_shapley, 3)

        const payment_elem = document.getElementById("payment" + i)
        payment_elem.textContent = fmt(payments[i - 1][len - 1])
    }

    const date_elem = document.getElementById("date")
    date_elem.textContent = "Day #" + (T - 9)

    const true_y_elem = document.getElementById("true-y")
    true_y_elem.textContent = fmt(y[init_size + len - 1])
    const prediction_elem = document.getElementById("grand-coalition-pred")
    prediction_elem.textContent = fmt(predictions[len - 1].get([0]))
    const err_elem = document.getElementById("grand-coalition-loss")
    const err = math.abs(predictions[len - 1].get([0]) - y[init_size + len - 1])
    err_elem.textContent = fmt(err)
    const central_agent_prediction_elem = document.getElementById("central-agent-pred")
    central_agent_prediction_elem.textContent = fmt(central_agent_predictions[len - 1].get([0]))
    const central_agent_err_elem = document.getElementById("central-agent-loss")
    const central_agent_err = math.abs(central_agent_predictions[len - 1].get([0]) - y[init_size + len - 1])
    central_agent_err_elem.textContent = fmt(central_agent_err)

    const feature_values = base_data[init_size + len - 1]
    console.log("feature_values", feature_values)

    const feature2_elem = document.getElementById("feature2")
    feature2_elem.textContent = fmt(feature_values[1]) + "mm"
    const feature3_elem = document.getElementById("feature3")
    feature3_elem.textContent = fmt(feature_values[2]) + "m/s"
    const feature4_elem = document.getElementById("feature4")
    feature4_elem.textContent = fmt(feature_values[3]) + "°C"

    const data_cost_elem = document.getElementById("data-cost")
    data_cost_elem.textContent = fmt(total_payment)
    const err_cost_elem = document.getElementById("err-cost")
    err_cost_elem.textContent = fmt(err * 5)
    const err_cost_central_agent_elem = document.getElementById("err-cost-central-agent")
    err_cost_central_agent_elem.textContent = fmt(central_agent_err * 5)

    const net_savings = central_agent_err * 5 - err * 5 - total_payment
    total_net_savings += net_savings
    const net_savings_elem = document.getElementById("profit")
    net_savings_elem.textContent = fmt(net_savings)
    const avg_net_savings_elem = document.getElementById("avg-profit")
    avg_net_savings_elem.textContent = fmt(total_net_savings / (T - 9))





    // const total_cost_elem = document.getElementById("total-cost")
    // total_cost_elem.textContent = fmt(total_payment + err * 5)




    T += 1
}
time_step()


// function run_bike_market() {

// }
