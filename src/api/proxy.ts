import * as vscode from "vscode";
import {HttpsProxyAgent, HttpsProxyAgentOptions} from "https-proxy-agent";
import {Agent, AgentOptions} from "https";
import {loadSystemCertificates} from "@vscode/proxy-agent";

import {log, logDebug, logError} from "../log";

let caCertificates: string[] = [];
let initialized = false;

// Initialize proxy settings and certificates
export async function initProxy() {
  if (initialized) return;
  try {
    // Provide a logger wrapper around our outcome channel logger
    const logger = {
      trace: (msg: string) => logDebug(msg),
      debug: (msg: string) => logDebug(msg),
      info: (msg: string) => log(msg),
      warn: (msg: string) => log(`WARN: ${msg}`),
      error: (msg: string | Error) => {
        if (msg instanceof Error) {
          logError(msg);
        } else {
          log(`ERROR: ${msg}`);
        }
      }
    };

    caCertificates = await loadSystemCertificates({log: logger});
    initialized = true;
  } catch (e) {
    logError(e as Error, "Failed to load system certificates");
  }
}

export function getAgent(): Agent | undefined {
  // Check for proxy setting in VS Code configuration first, then environment variables
  const config = vscode.workspace.getConfiguration("http");
  const proxy =
    config.get<string>("proxy") ||
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy;

  const options: HttpsProxyAgentOptions<string> & AgentOptions = {
    keepAlive: true
  };

  if (caCertificates.length > 0) {
    options.ca = caCertificates;
  }

  if (proxy) {
    return new HttpsProxyAgent(proxy, options);
  } else if (caCertificates.length > 0) {
    // If no proxy is configured but we have system certificates, use them with a standard Agent
    return new Agent(options);
  }

  return undefined;
}
