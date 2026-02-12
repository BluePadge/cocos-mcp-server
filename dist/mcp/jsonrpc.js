"use strict";
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseJsonRpcBody = parseJsonRpcBody;
exports.readRawBody = readRawBody;
const errors_1 = require("./errors");
function parseJsonRpcBody(rawBody) {
    const body = rawBody.trim();
    if (!body) {
        return {
            ok: false,
            response: (0, errors_1.createJsonRpcErrorResponse)(null, errors_1.JsonRpcErrorCode.InvalidRequest, 'Invalid Request: request body cannot be empty')
        };
    }
    try {
        return {
            ok: true,
            payload: JSON.parse(body)
        };
    }
    catch (error) {
        return {
            ok: false,
            response: (0, errors_1.createJsonRpcErrorResponse)(null, errors_1.JsonRpcErrorCode.ParseError, `Parse error: ${error.message}`)
        };
    }
}
async function readRawBody(req) {
    var _a, e_1, _b, _c;
    let body = '';
    try {
        for (var _d = true, req_1 = __asyncValues(req), req_1_1; req_1_1 = await req_1.next(), _a = req_1_1.done, !_a; _d = true) {
            _c = req_1_1.value;
            _d = false;
            const chunk = _c;
            body += chunk.toString();
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (!_d && !_a && (_b = req_1.return)) await _b.call(req_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return body;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoianNvbnJwYy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS9tY3AvanNvbnJwYy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFjQSw0Q0E2QkM7QUFFRCxrQ0FRQztBQXJERCxxQ0FBOEY7QUFjOUYsU0FBZ0IsZ0JBQWdCLENBQUMsT0FBZTtJQUM1QyxNQUFNLElBQUksR0FBRyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUM7SUFFNUIsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ1IsT0FBTztZQUNILEVBQUUsRUFBRSxLQUFLO1lBQ1QsUUFBUSxFQUFFLElBQUEsbUNBQTBCLEVBQ2hDLElBQUksRUFDSix5QkFBZ0IsQ0FBQyxjQUFjLEVBQy9CLCtDQUErQyxDQUNsRDtTQUNKLENBQUM7SUFDTixDQUFDO0lBRUQsSUFBSSxDQUFDO1FBQ0QsT0FBTztZQUNILEVBQUUsRUFBRSxJQUFJO1lBQ1IsT0FBTyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDO1NBQzVCLENBQUM7SUFDTixDQUFDO0lBQUMsT0FBTyxLQUFVLEVBQUUsQ0FBQztRQUNsQixPQUFPO1lBQ0gsRUFBRSxFQUFFLEtBQUs7WUFDVCxRQUFRLEVBQUUsSUFBQSxtQ0FBMEIsRUFDaEMsSUFBSSxFQUNKLHlCQUFnQixDQUFDLFVBQVUsRUFDM0IsZ0JBQWdCLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FDbEM7U0FDSixDQUFDO0lBQ04sQ0FBQztBQUNMLENBQUM7QUFFTSxLQUFLLFVBQVUsV0FBVyxDQUFDLEdBQTBCOztJQUN4RCxJQUFJLElBQUksR0FBRyxFQUFFLENBQUM7O1FBRWQsS0FBMEIsZUFBQSxRQUFBLGNBQUEsR0FBRyxDQUFBLFNBQUEsbUVBQUUsQ0FBQztZQUFOLG1CQUFHO1lBQUgsV0FBRztZQUFsQixNQUFNLEtBQUssS0FBQSxDQUFBO1lBQ2xCLElBQUksSUFBSSxLQUFLLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDN0IsQ0FBQzs7Ozs7Ozs7O0lBRUQsT0FBTyxJQUFJLENBQUM7QUFDaEIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGNyZWF0ZUpzb25ScGNFcnJvclJlc3BvbnNlLCBKc29uUnBjRXJyb3JDb2RlLCBKc29uUnBjRXJyb3JSZXNwb25zZSB9IGZyb20gJy4vZXJyb3JzJztcblxuZXhwb3J0IGludGVyZmFjZSBKc29uUnBjUGFyc2VTdWNjZXNzIHtcbiAgICBvazogdHJ1ZTtcbiAgICBwYXlsb2FkOiB1bmtub3duO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEpzb25ScGNQYXJzZUZhaWx1cmUge1xuICAgIG9rOiBmYWxzZTtcbiAgICByZXNwb25zZTogSnNvblJwY0Vycm9yUmVzcG9uc2U7XG59XG5cbmV4cG9ydCB0eXBlIEpzb25ScGNQYXJzZVJlc3VsdCA9IEpzb25ScGNQYXJzZVN1Y2Nlc3MgfCBKc29uUnBjUGFyc2VGYWlsdXJlO1xuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VKc29uUnBjQm9keShyYXdCb2R5OiBzdHJpbmcpOiBKc29uUnBjUGFyc2VSZXN1bHQge1xuICAgIGNvbnN0IGJvZHkgPSByYXdCb2R5LnRyaW0oKTtcblxuICAgIGlmICghYm9keSkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgb2s6IGZhbHNlLFxuICAgICAgICAgICAgcmVzcG9uc2U6IGNyZWF0ZUpzb25ScGNFcnJvclJlc3BvbnNlKFxuICAgICAgICAgICAgICAgIG51bGwsXG4gICAgICAgICAgICAgICAgSnNvblJwY0Vycm9yQ29kZS5JbnZhbGlkUmVxdWVzdCxcbiAgICAgICAgICAgICAgICAnSW52YWxpZCBSZXF1ZXN0OiByZXF1ZXN0IGJvZHkgY2Fubm90IGJlIGVtcHR5J1xuICAgICAgICAgICAgKVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBvazogdHJ1ZSxcbiAgICAgICAgICAgIHBheWxvYWQ6IEpTT04ucGFyc2UoYm9keSlcbiAgICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBvazogZmFsc2UsXG4gICAgICAgICAgICByZXNwb25zZTogY3JlYXRlSnNvblJwY0Vycm9yUmVzcG9uc2UoXG4gICAgICAgICAgICAgICAgbnVsbCxcbiAgICAgICAgICAgICAgICBKc29uUnBjRXJyb3JDb2RlLlBhcnNlRXJyb3IsXG4gICAgICAgICAgICAgICAgYFBhcnNlIGVycm9yOiAke2Vycm9yLm1lc3NhZ2V9YFxuICAgICAgICAgICAgKVxuICAgICAgICB9O1xuICAgIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlYWRSYXdCb2R5KHJlcTogTm9kZUpTLlJlYWRhYmxlU3RyZWFtKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICBsZXQgYm9keSA9ICcnO1xuXG4gICAgZm9yIGF3YWl0IChjb25zdCBjaHVuayBvZiByZXEpIHtcbiAgICAgICAgYm9keSArPSBjaHVuay50b1N0cmluZygpO1xuICAgIH1cblxuICAgIHJldHVybiBib2R5O1xufVxuIl19