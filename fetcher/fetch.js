var fs = require('fs');
var https = require('https');
var rateLimit;
function githubRequest(prefix, owner, repo, path, params, done) {
    rateLimit--;
    if (rateLimit === 0) {
        console.log('Aborting because we are about to hit the rate limit');
    }
    var oath = JSON.parse(fs.readFileSync('../../search-auth.json', 'utf-8'));
    params['client_id'] = oath['client-id'];
    params['client_secret'] = oath['client-secret'];
    var parts = [prefix, owner, repo, path].filter(function (s) { return !!s; });
    var paramStr = Object.keys(params).map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
    var options = {
        host: 'api.github.com',
        path: '/' + parts.join('/') + '?' + paramStr,
        headers: {
            'User-Agent': 'RyanCavanaugh',
            'Accept': 'text/json'
        },
        method: 'GET'
    };
    https.get(options, function (res) {
        var data = '';
        res.on('data', function (d) {
            data = data + d;
        });
        res.on('end', function () {
            done(data);
        });
    });
}
githubRequest('rate_limit', undefined, undefined, undefined, {}, function (rateLimitStr) {
    var rates = JSON.parse(rateLimitStr);
    rateLimit = rates['rate']['remaining'];
    console.log('Started up; remaining rate limit = ' + rateLimit);
});
function fetchPage(pageNumber, done) {
    var params = {};
    params['sort'] = 'updated';
    params['per_page'] = '100';
    params['state'] = 'all';
    params['page'] = pageNumber.toString();
    githubRequest('repos', 'Microsoft', 'TypeScript', 'issues', params, function (issueStr) {
        var issuesJson = JSON.parse(issueStr);
        done(issuesJson);
    });
}
;
function byUpdateTime(lhs, rhs) {
    return Date.parse(rhs.updated_at) - Date.parse(lhs.updated_at);
}
var dataFile = 'issues.json';
var issuesArray = [];
function save() {
    if (fs.existsSync(dataFile)) {
        var tmp = dataFile + '.tmp';
        var old = dataFile + '.old';
        fs.writeFileSync(tmp, JSON.stringify(issuesArray));
        fs.renameSync(dataFile, old);
        fs.renameSync(tmp, dataFile);
        fs.unlinkSync(old);
    }
    else {
        fs.writeFileSync(dataFile, JSON.stringify(issuesArray));
    }
}
if (fs.existsSync(dataFile)) {
    issuesArray = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
    console.log("Read " + issuesArray.length + ' issues from disk');
}
issuesArray.sort(byUpdateTime);
function fetchUpdatedIssues(completed) {
    var page = 1;
    function nextPage() {
        console.log('Fetch page #' + page);
        fetchPage(page, function (newIssues) {
            var done = newIssues.length === 0;
            // Merge in the new issues
            newIssues.forEach(function (issue) {
                // Do we already have a copy of this issue?
                var index = -1;
                for (var i = 0; i < issuesArray.length; i++) {
                    if (issuesArray[i].number === issue.number) {
                        index = i;
                        break;
                    }
                }
                if (index === -1) {
                    // Didn't have it before
                    issuesArray.push(issue);
                }
                else {
                    // Maybe we're done?
                    if (issuesArray[index].updated_at === issue.updated_at) {
                        done = true;
                    }
                    else {
                        // Update the array
                        issuesArray[index] = issue;
                    }
                }
            });
            // Save
            save();
            if (!done) {
                page++;
                nextPage();
            }
            else {
                completed();
            }
        });
    }
    // Keep fetching issues by their update time until we find some overlap with the existing array
    nextPage();
}
function fetchCommentsForIssue(id, completed) {
    var page = 1;
    var result = [];
    function fetchNext() {
        var pageSize = 100;
        var params = {};
        params['per_page'] = pageSize.toString();
        params['page'] = page.toString();
        githubRequest('repos', 'Microsoft', 'TypeScript', 'issues/' + id + '/comments', params, function (dataStr) {
            var data = JSON.parse(dataStr);
            result = result.concat(data);
            if (data.length < pageSize) {
                completed(result);
            }
            else {
                page++;
                fetchNext();
            }
        });
    }
    fetchNext();
}
function fetchComments(completed) {
    var done = false;
    function getComments(issue) {
        fetchCommentsForIssue(issue.number, function (comments) {
            console.log('Downloaded ' + comments.length + ' comments for ' + issue.number);
            issue.fetchedComments = comments;
            save();
            next();
        });
    }
    function next() {
        var didAnything = false;
        for (var i = 0; i < issuesArray.length; i++) {
            issuesArray[i].fetchedComments = issuesArray[i].fetchedComments || [];
            if (issuesArray[i].fetchedComments.length < issuesArray[i].comments) {
                console.log('Fetching comments for ' + issuesArray[i].number + ', expect to get ' + issuesArray[i].comments);
                getComments(issuesArray[i]);
                didAnything = true;
                break;
            }
        }
        if (!didAnything) {
            completed();
        }
    }
    next();
}
console.log('Updating our issue list');
fetchUpdatedIssues(function () {
    console.log('Done fetching issues; fetching comments now');
    fetchComments(function () {
        console.log('Done fetching comments');
    });
});
