import * as http from 'http';

// A quick thing for handling the OOB codes endpoint on the authentication emulator.

type OobCode = {
  email: string | undefined;
  oobLink: string | undefined;
}

type OobDocument = {
  oobCodes: OobCode[] | undefined;
}

async function getOobLink(email: string): Promise<string> {
  // Use the default Firebase project name for the emulator
  const projectName = 'hexland-test';

  // Retry logic to handle async emulator operations
  const maxRetries = 10;
  const retryDelay = 200; // ms

  for (let i = 0; i < maxRetries; i++) {
    const d = await new Promise<OobDocument>((resolve, reject) => {
      const url = `http://localhost:9099/emulator/v1/projects/${projectName}/oobCodes`;

      const req = http.get(url, res => {
        if (res.statusCode !== 200) {
          reject('Oob document returned status: ' + res.statusCode);
          return;
        }

        let output = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { output += chunk; });
        res.on('end', () => {
          try {
            const doc = JSON.parse(output);
            resolve(doc as OobDocument);
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', (e) => {
        reject(e);
      });
    });

    const oobLink = d.oobCodes?.find(c => c.email === email)?.oobLink;
    if (oobLink) {
      return oobLink;
    }

    // Wait before retrying
    if (i < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  throw Error("No OOB link for " + email + " after " + maxRetries + " retries");
}

export async function verifyEmail(email: string): Promise<void> {
  const oobLink = await getOobLink(email);

  // This just needs to return 200 OK
  await new Promise<void>((resolve, reject) => {
    http.get(oobLink, res => {
      if (res.statusCode !== 200) {
        reject('Verify link returned status: ' + res.statusCode);
      }

      resolve();
    });
  });
}