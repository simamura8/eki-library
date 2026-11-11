import {execFileSync} from 'node:child_process';
const sha=execFileSync('git',['subtree','split','--prefix','public','HEAD'],{encoding:'utf8'}).trim();
execFileSync('git',['push','origin',`${sha}:refs/heads/gh-pages`],{stdio:'inherit'});
