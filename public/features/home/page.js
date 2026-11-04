import { icon } from '../../core/icons.js';
export function createFeaturesHomePage(context) {
    const S = context.state;
    const shell = (...args) => context.shell(...args);
    function home() {
        shell(`<main class="home"><div class="home-content"><h1>Live quizzes<span>.</span></h1><div class="home-actions"><a href="#host" class="action-card primary"><div class="action-icon">${icon('quiz', 36)}</div><span class="arrow">↗</span><h2>Host quiz</h2></a><a href="#join" class="action-card"><div class="action-icon" style="color:var(--green)">${icon('users', 36)}</div><span class="arrow">↗</span><h2>Join quiz</h2></a><a href="#learn" class="action-card learn-home-card"><div class="action-icon">${icon('learn', 32)}</div><h2>Learn <span class="learn-beta">beta</span></h2><span class="arrow">↗</span></a></div></div></main>`);
    }
    return { home };
}
