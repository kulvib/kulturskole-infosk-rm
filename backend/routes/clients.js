// ...
router.patch('/:id/approve', async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).send({ error: 'Client not found' });
    client.status = "approved";
    await client.save();
    res.send({ success: true });
  } catch (e) {
    res.status(500).send({ error: 'Server error' });
  }
});
