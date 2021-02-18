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
  const d = await new Promise<OobDocument>((resolve, reject) => {
    http.get(
      `http://localhost:9099/emulator/v1/projects/hexland-test-${process.env.USER}/oobCodes`,
      res => {
        if (res.statusCode !== 200) {
          reject('Oob document returned status: ' + res.statusCode);
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
      }
    )
  });

  const oobLink = d.oobCodes?.find(c => c.email === email)?.oobLink;
  if (!oobLink) {
    throw Error("No OOB link for " + email);
  }

  return oobLink;
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